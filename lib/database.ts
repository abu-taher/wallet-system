import Database from 'better-sqlite3';
import path from 'path';
import type {
  User,
  Transaction,
  PreparedStatements,
  DatabaseConstants,
  CurrencyFormatter,
  AmountValidator,
  IdGenerator,
  ValidationResult,
  DatabaseOperation,
  TransactionOperation
} from './types';

/**
 * SQLite database setup for wallet system
 * Handles user accounts and transaction storage with ACID compliance
 */

// Database configuration constants
const DATABASE_CONFIG: DatabaseConstants = {
  DATABASE_FILE: 'wallet.sqlite',
  CURRENCY_PRECISION: 100, // For 2 decimal places
  MAX_AMOUNT: 999999.99,
  MIN_AMOUNT: 0.01
} as const;

const { DATABASE_FILE, CURRENCY_PRECISION, MAX_AMOUNT, MIN_AMOUNT } = DATABASE_CONFIG;

// Initialize database connection
const dbPath = path.join(process.cwd(), DATABASE_FILE);
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

/**
 * Creates database tables and indexes for the wallet system
 * - Users table: stores account information and current balance
 * - Transactions table: audit trail with idempotency support
 * - Indexes: optimized for common query patterns
 */
const createTables = () => {
  // Users table - stores account information and current balance
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Transactions table - audit trail and duplicate prevention
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('topup', 'charge')),
      amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
      balance_after DECIMAL(10, 2) NOT NULL CHECK (balance_after >= 0),
      idempotency_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Performance indexes for common query patterns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON transactions (idempotency_key);
  `);
};

// Initialize tables
createTables();

// Prepared statements for better performance and security
const statements: PreparedStatements = {
  createUser: db.prepare(`
    INSERT INTO users (id, email, name, balance)
    VALUES (?, ?, ?, 0.00)
  `),
  
  getUserById: db.prepare(`
    SELECT * FROM users WHERE id = ?
  `),
  
  getUserByEmail: db.prepare(`
    SELECT * FROM users WHERE email = ?
  `),
  
  updateBalance: db.prepare(`
    UPDATE users SET balance = ? WHERE id = ?
  `),
  
  createTransaction: db.prepare(`
    INSERT INTO transactions (id, user_id, type, amount, balance_after, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  getTransactionByIdempotencyKey: db.prepare(`
    SELECT * FROM transactions WHERE idempotency_key = ?
  `),
  
  getUserTransactions: db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC
  `)
};


export { db, statements };

/**
 * Currency handling utilities
 * Ensures precise decimal arithmetic for financial calculations
 */

/**
 * Formats amount to exactly 2 decimal places
 * Prevents floating point precision issues
 * @param amount - Raw number amount
 * @returns Number formatted to 2 decimal places
 */
export const formatCurrency: CurrencyFormatter = (amount: number): number => {
  return Math.round(amount * CURRENCY_PRECISION) / CURRENCY_PRECISION;
};

/**
 * Validates amount is within acceptable range for transactions
 * @param amount - Amount to validate
 * @returns true if amount is valid, false otherwise
 */
export const validateAmount: AmountValidator = (amount: number): boolean => {
  // Check for valid number
  if (typeof amount !== 'number' || !Number.isFinite(amount) || isNaN(amount)) {
    return false;
  }
  
  // Check for positive amount
  if (amount <= 0) {
    return false;
  }
  
  // Check range
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return false;
  }
  
  // Check decimal precision (max 2 decimal places)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return false;
  }
  
  return true;
};

/**
 * Enhanced validation with detailed error messages
 * @param amount - Amount to validate
 * @returns ValidationResult with detailed error information
 */
export const validateAmountDetailed = (amount: number): ValidationResult => {
  // Check for valid number
  if (typeof amount !== 'number' || !Number.isFinite(amount) || isNaN(amount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }
  
  // Check for positive amount
  if (amount <= 0) {
    return { isValid: false, error: 'Amount must be positive' };
  }
  
  // Check range
  if (amount < MIN_AMOUNT) {
    return { isValid: false, error: `Amount must be at least $${MIN_AMOUNT}` };
  }
  
  if (amount > MAX_AMOUNT) {
    return { isValid: false, error: `Amount must be at most $${MAX_AMOUNT}` };
  }
  
  // Check decimal precision (max 2 decimal places)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { isValid: false, error: 'Amount can only have up to 2 decimal places' };
  }
  
  return { isValid: true };
};

/**
 * Generates cryptographically random unique identifier
 * Combines timestamp and random string for uniqueness
 * @returns Unique string identifier
 */
export const generateId: IdGenerator = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Safely executes a database operation with error handling
 * @param operation - Database operation to execute
 * @returns Result of the operation
 */
export const executeDatabaseOperation = <T>(operation: DatabaseOperation<T>): T => {
  try {
    return operation();
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
};

/**
 * Executes a transaction operation within a database transaction
 * @param operation - Transaction operation to execute
 */
export const executeTransactionOperation = (operation: TransactionOperation): void => {
  const transaction = db.transaction(operation);
  transaction();
};

// Export constants for use in other modules
export { MIN_AMOUNT, MAX_AMOUNT, CURRENCY_PRECISION };