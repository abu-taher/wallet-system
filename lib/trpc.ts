import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import { 
  db,
  statements, 
  formatCurrency, 
  validateAmount, 
  generateId,
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

/**
 * tRPC Router for Wallet System API
 * Implements three core endpoints: createAccount, topUp, charge
 * Features: type safety, currency precision, duplicate prevention
 */

export const createTRPCContext = async (opts: TRPCContext) => {
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
        const existingUser = statements.getUserByEmail.get(input.email) as User | undefined;
        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }
        
        // Create new user
        statements.createUser.run(userId, input.email, input.name);
        
        const newUser = statements.getUserById.get(userId) as User;
        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          balance: formatCurrency(newUser.balance),
        } satisfies UserResponse;
      } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }
        throw error;
      }
    }),

  // Top-Up Endpoint (Add balance)
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
      const existingTransaction = statements.getTransactionByIdempotencyKey.get(idempotencyKey) as Transaction | undefined;
      if (existingTransaction) {
        // Return the existing transaction result
        const user = statements.getUserById.get(userId) as User;
        return {
          success: true,
          transactionId: existingTransaction.id,
          newBalance: formatCurrency(user.balance),
          amount: formatCurrency(existingTransaction.amount),
          duplicate: true,
        } satisfies TransactionResponse;
      }
      
      // Get user
      const user = statements.getUserById.get(userId) as User | undefined;
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      // Calculate new balance
      const currentBalance = formatCurrency(user.balance);
      const newBalance = formatCurrency(currentBalance + formattedAmount);
      
      // Update balance and create transaction in a single transaction
      const transactionId = generateId();
      
      try {
        const transaction = db.transaction(() => {
          statements.updateBalance.run(newBalance, userId);
          statements.createTransaction.run(
            transactionId,
            userId,
            'topup',
            formattedAmount,
            newBalance,
            idempotencyKey
          );
        });
        
        transaction();
        
        return {
          success: true,
          transactionId,
          newBalance,
          amount: formattedAmount,
          duplicate: false,
        } satisfies TransactionResponse;
      } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          // Race condition: another request with same idempotency key succeeded
          const existingTransaction = statements.getTransactionByIdempotencyKey.get(idempotencyKey) as Transaction;
          const updatedUser = statements.getUserById.get(userId) as User;
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
      const existingTransaction = statements.getTransactionByIdempotencyKey.get(idempotencyKey) as Transaction | undefined;
      if (existingTransaction) {
        // Return the existing transaction result
        const user = statements.getUserById.get(userId) as User;
        return {
          success: true,
          transactionId: existingTransaction.id,
          newBalance: formatCurrency(user.balance),
          amount: formatCurrency(existingTransaction.amount),
          duplicate: true,
        } satisfies TransactionResponse;
      }
      
      // Get user
      const user = statements.getUserById.get(userId) as User | undefined;
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
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
        const transaction = db.transaction(() => {
          statements.updateBalance.run(newBalance, userId);
          statements.createTransaction.run(
            transactionId,
            userId,
            'charge',
            formattedAmount,
            newBalance,
            idempotencyKey
          );
        });
        
        transaction();
        
        return {
          success: true,
          transactionId,
          newBalance,
          amount: formattedAmount,
          duplicate: false,
        } satisfies TransactionResponse;
      } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          // Race condition: another request with same idempotency key succeeded
          const existingTransaction = statements.getTransactionByIdempotencyKey.get(idempotencyKey) as Transaction;
          const updatedUser = statements.getUserById.get(userId) as User;
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
      const user = statements.getUserByEmail.get(input.email) as User | undefined;
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No user found with this email address',
        });
      }
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
      const user = statements.getUserById.get(input.userId) as User | undefined;
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
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
      const user = statements.getUserById.get(input.userId) as User | undefined;
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      const transactions = statements.getUserTransactions.all(input.userId) as Transaction[];
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