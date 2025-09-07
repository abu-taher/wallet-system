/**
 * TypeScript type definitions for the Wallet System
 * Provides comprehensive type safety across all layers of the application
 */

// Database Entity Types
export interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  idempotency_key: string | null;
  created_at: string;
}

// Enums and Union Types
export type TransactionType = 'topup' | 'charge';

// API Request Types
export interface CreateAccountRequest {
  email: string;
  name: string;
}

export interface TopUpRequest {
  userId: string;
  amount: number;
  idempotencyKey: string;
}

export interface ChargeRequest {
  userId: string;
  amount: number;
  idempotencyKey: string;
}

export interface GetUserByEmailRequest {
  email: string;
}

export interface GetUserRequest {
  userId: string;
}

export interface GetUserTransactionsRequest {
  userId: string;
}

// API Response Types
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  balance: number;
}

export interface TransactionResponse {
  success: boolean;
  transactionId: string;
  newBalance: number;
  amount: number;
  duplicate: boolean;
}

export interface TransactionHistoryItem {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  idempotencyKey: string | null;
}

// Component Props Types
export interface WalletFormData {
  email: string;
  name: string;
  searchEmail: string;
  userId: string;
  amount: string;
}

export interface FormState {
  isLoading: boolean;
  error: string | null;
  result: any;
}

// Database Constants Types
export interface DatabaseConstants {
  readonly CURRENCY_PRECISION: number;
  readonly MAX_AMOUNT: number;
  readonly MIN_AMOUNT: number;
  readonly DATABASE_FILE: string;
}

// Utility Types
export type DatabaseOperation<T> = () => T;
export type TransactionOperation = () => void;

// Error Types
export interface WalletError {
  code: string;
  message: string;
  field?: string;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// tRPC Context Type
export interface TRPCContext {
  req?: any;
  res?: any;
}

// Database Statement Types
export interface PreparedStatements {
  createUser: any;
  getUserById: any;
  getUserByEmail: any;
  updateBalance: any;
  createTransaction: any;
  getTransactionByIdempotencyKey: any;
  getUserTransactions: any;
}

// Currency Utility Types
export type CurrencyFormatter = (amount: number) => number;
export type AmountValidator = (amount: number) => boolean;
export type IdGenerator = () => string;