import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import { 
  db,
  statements, 
  formatCurrency, 
  validateAmount, 
  generateId,
  convertToUser,
  convertToTransaction,
  MIN_AMOUNT,
  MAX_AMOUNT 
} from './database';
import type {
  User,
  Transaction,
  TRPCContext,
  UserResponse,
  TransactionResponse,
  TransactionHistoryItem,
  CreateAccountRequest,
  TopUpRequest,
  ChargeRequest,
  GetUserByEmailRequest,
  GetUserRequest,
  GetUserTransactionsRequest
} from './types';

export const createTRPCContext = async (_opts: TRPCContext) => {
  return {};
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  // Create Account Endpoint
  createAccount: publicProcedure
    .input(z.object({
      email: z.string()
        .email('Invalid email format')
        .min(3, 'Email must be at least 3 characters')
        .max(255, 'Email must be less than 255 characters')
        .trim()
        .toLowerCase(),
      name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters')
        .trim()
        .refine(val => val.length > 0, 'Name cannot be empty or whitespace only'),
    }))
    .mutation(async ({ input }: { input: CreateAccountRequest }) => {
      const userId = generateId();
      
      try {
        // Check if user already exists
        const existingUserResult = await statements.getUserByEmail(input.email);
        if (existingUserResult.rows.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }
        
        // Create new user
        await statements.createUser(userId, input.email, input.name);
        
        const newUserResult = await statements.getUserById(userId);
        const newUser = convertToUser(newUserResult.rows[0]);
        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          balance: formatCurrency(newUser.balance),
        } satisfies UserResponse;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'message' in error && 
            typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }
        throw error;
      }
    }),

  // Top-Up Endpoint (Add balance)
  topUp: publicProcedure
    .input(z.object({
      userId: z.string()
        .min(1, 'User ID is required')
        .max(255, 'User ID too long')
        .trim()
        .refine(val => val.length > 0, 'User ID cannot be empty'),
      amount: z.number({
        required_error: 'Amount is required',
        invalid_type_error: 'Amount must be a number',
      })
        .min(MIN_AMOUNT, `Amount must be at least $${MIN_AMOUNT}`)
        .max(MAX_AMOUNT, `Amount must be at most $${MAX_AMOUNT}`)
        .finite('Amount must be a finite number')
        .refine(val => Number.isFinite(val) && val > 0, 'Amount must be a positive finite number')
        .refine(val => Math.round(val * 100) / 100 === val, 'Amount can only have up to 2 decimal places'),
      idempotencyKey: z.string()
        .min(1, 'Idempotency key is required to prevent duplicate transactions')
        .max(255, 'Idempotency key is too long (maximum 255 characters)')
        .trim()
        .refine(val => val.length > 0, 'Idempotency key cannot be empty'),
    }))
    .mutation(async ({ input }: { input: TopUpRequest }) => {
      const { userId, amount, idempotencyKey } = input;
      
      // Validate amount
      if (!validateAmount(amount)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid amount. Must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}`,
        });
      }
      
      const formattedAmount = formatCurrency(amount);
      
      // Check for duplicate transaction
      const existingTransactionResult = await statements.getTransactionByIdempotencyKey(idempotencyKey);
      if (existingTransactionResult.rows.length > 0) {
        const existingTransaction = convertToTransaction(existingTransactionResult.rows[0]);
        // Return the existing transaction result
        const userResult = await statements.getUserById(userId);
        const user = convertToUser(userResult.rows[0]);
        return {
          success: true,
          transactionId: existingTransaction.id,
          newBalance: formatCurrency(user.balance),
          amount: formatCurrency(existingTransaction.amount),
          duplicate: true,
        } satisfies TransactionResponse;
      }
      
      // Get user
      const userResult = await statements.getUserById(userId);
      if (userResult.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      const user = convertToUser(userResult.rows[0]);
      
      // Calculate new balance
      const currentBalance = formatCurrency(user.balance);
      const newBalance = formatCurrency(currentBalance + formattedAmount);
      
      // Update balance and create transaction in a single transaction
      const transactionId = generateId();
      
      try {
        // Use batch for transaction
        await db.batch([
          { sql: 'BEGIN', args: [] },
          { 
            sql: 'UPDATE users SET balance = ? WHERE id = ?', 
            args: [newBalance, userId] 
          },
          {
            sql: 'INSERT INTO transactions (id, user_id, type, amount, balance_after, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)',
            args: [transactionId, userId, 'topup', formattedAmount, newBalance, idempotencyKey]
          },
          { sql: 'COMMIT', args: [] }
        ]);
        
        return {
          success: true,
          transactionId,
          newBalance,
          amount: formattedAmount,
          duplicate: false,
        } satisfies TransactionResponse;
      } catch (error: unknown) {
        // Rollback on error
        try {
          await db.execute({ sql: 'ROLLBACK', args: [] });
        } catch {}
        
        if (error && typeof error === 'object' && 'message' in error && 
            typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed')) {
          // Race condition: another request with same idempotency key succeeded
          const existingTransactionResult = await statements.getTransactionByIdempotencyKey(idempotencyKey);
          const existingTransaction = convertToTransaction(existingTransactionResult.rows[0]);
          const updatedUserResult = await statements.getUserById(userId);
          const updatedUser = convertToUser(updatedUserResult.rows[0]);
          return {
            success: true,
            transactionId: existingTransaction.id,
            newBalance: formatCurrency(updatedUser.balance),
            amount: formatCurrency(existingTransaction.amount),
            duplicate: true,
          } satisfies TransactionResponse;
        }
        throw error;
      }
    }),

  // Charge Endpoint (Deduct balance)
  charge: publicProcedure
    .input(z.object({
      userId: z.string()
        .min(1, 'User ID is required')
        .max(255, 'User ID too long')
        .trim()
        .refine(val => val.length > 0, 'User ID cannot be empty'),
      amount: z.number({
        required_error: 'Amount is required',
        invalid_type_error: 'Amount must be a number',
      })
        .min(MIN_AMOUNT, `Amount must be at least $${MIN_AMOUNT}`)
        .max(MAX_AMOUNT, `Amount must be at most $${MAX_AMOUNT}`)
        .finite('Amount must be a finite number')
        .refine(val => Number.isFinite(val) && val > 0, 'Amount must be a positive finite number')
        .refine(val => Math.round(val * 100) / 100 === val, 'Amount can only have up to 2 decimal places'),
      idempotencyKey: z.string()
        .min(1, 'Idempotency key is required to prevent duplicate transactions')
        .max(255, 'Idempotency key is too long (maximum 255 characters)')
        .trim()
        .refine(val => val.length > 0, 'Idempotency key cannot be empty'),
    }))
    .mutation(async ({ input }: { input: ChargeRequest }) => {
      const { userId, amount, idempotencyKey } = input;
      
      // Validate amount
      if (!validateAmount(amount)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid amount. Must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}`,
        });
      }
      
      const formattedAmount = formatCurrency(amount);
      
      // Check for duplicate transaction
      const existingTransactionResult = await statements.getTransactionByIdempotencyKey(idempotencyKey);
      if (existingTransactionResult.rows.length > 0) {
        const existingTransaction = convertToTransaction(existingTransactionResult.rows[0]);
        // Return the existing transaction result
        const userResult = await statements.getUserById(userId);
        const user = convertToUser(userResult.rows[0]);
        return {
          success: true,
          transactionId: existingTransaction.id,
          newBalance: formatCurrency(user.balance),
          amount: formatCurrency(existingTransaction.amount),
          duplicate: true,
        } satisfies TransactionResponse;
      }
      
      // Get user
      const userResult = await statements.getUserById(userId);
      if (userResult.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      const user = convertToUser(userResult.rows[0]);
      
      // Check sufficient balance
      const currentBalance = formatCurrency(user.balance);
      if (currentBalance < formattedAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient funds',
        });
      }
      
      // Calculate new balance
      const newBalance = formatCurrency(currentBalance - formattedAmount);
      
      // Ensure balance never goes negative (additional safety check)
      if (newBalance < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Operation would result in negative balance',
        });
      }
      
      // Update balance and create transaction in a single transaction
      const transactionId = generateId();
      
      try {
        // Use batch for transaction
        await db.batch([
          { sql: 'BEGIN', args: [] },
          { 
            sql: 'UPDATE users SET balance = ? WHERE id = ?', 
            args: [newBalance, userId] 
          },
          {
            sql: 'INSERT INTO transactions (id, user_id, type, amount, balance_after, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)',
            args: [transactionId, userId, 'charge', formattedAmount, newBalance, idempotencyKey]
          },
          { sql: 'COMMIT', args: [] }
        ]);
        
        return {
          success: true,
          transactionId,
          newBalance,
          amount: formattedAmount,
          duplicate: false,
        } satisfies TransactionResponse;
      } catch (error: unknown) {
        // Rollback on error
        try {
          await db.execute({ sql: 'ROLLBACK', args: [] });
        } catch {}
        
        if (error && typeof error === 'object' && 'message' in error && 
            typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed')) {
          // Race condition: another request with same idempotency key succeeded
          const existingTransactionResult = await statements.getTransactionByIdempotencyKey(idempotencyKey);
          const existingTransaction = convertToTransaction(existingTransactionResult.rows[0]);
          const updatedUserResult = await statements.getUserById(userId);
          const updatedUser = convertToUser(updatedUserResult.rows[0]);
          return {
            success: true,
            transactionId: existingTransaction.id,
            newBalance: formatCurrency(updatedUser.balance),
            amount: formatCurrency(existingTransaction.amount),
            duplicate: true,
          } satisfies TransactionResponse;
        }
        throw error;
      }
    }),

  // Helper endpoints for testing/admin
  getUserByEmail: publicProcedure
    .input(z.object({ 
      email: z.string()
        .email('Invalid email format')
        .min(3, 'Email must be at least 3 characters')
        .max(255, 'Email must be less than 255 characters')
        .trim()
        .toLowerCase()
    }))
    .query(async ({ input }: { input: GetUserByEmailRequest }) => {
      const userResult = await statements.getUserByEmail(input.email);
      if (userResult.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No user found with this email address',
        });
      }
      const user = convertToUser(userResult.rows[0]);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: formatCurrency(user.balance),
      } satisfies UserResponse;
    }),

  getUser: publicProcedure
    .input(z.object({ 
      userId: z.string()
        .min(1, 'User ID is required')
        .max(255, 'User ID too long')
        .trim()
        .refine(val => val.length > 0, 'User ID cannot be empty')
    }))
    .query(async ({ input }: { input: GetUserRequest }) => {
      const userResult = await statements.getUserById(input.userId);
      if (userResult.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      const user = convertToUser(userResult.rows[0]);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: formatCurrency(user.balance),
      } satisfies UserResponse;
    }),

  getUserTransactions: publicProcedure
    .input(z.object({ 
      userId: z.string()
        .min(1, 'User ID is required')
        .max(255, 'User ID too long')
        .trim()
        .refine(val => val.length > 0, 'User ID cannot be empty')
    }))
    .query(async ({ input }: { input: GetUserTransactionsRequest }) => {
      const userResult = await statements.getUserById(input.userId);
      if (userResult.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      const transactionsResult = await statements.getUserTransactions(input.userId);
      const transactions = transactionsResult.rows.map(convertToTransaction);
      return transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: formatCurrency(tx.amount),
        balanceAfter: formatCurrency(tx.balance_after),
        createdAt: tx.created_at,
        idempotencyKey: tx.idempotency_key,
      } satisfies TransactionHistoryItem));
    }),
});

export type AppRouter = typeof appRouter;