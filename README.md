# Wallet System API

A simple wallet system API built with Next.js 15, tRPC, and SQLite that manages user accounts with basic wallet operations.

## Features

- **Create Account**: Create new user accounts with email and name
- **Top-Up**: Add balance to user accounts with precise currency handling
- **Charge**: Deduct balance from user accounts with negative balance prevention
- **Currency Precision**: All amounts handled with 2 decimal places precision
- **Duplicate Prevention**: Idempotency keys prevent duplicate transactions
- **SQLite Database**: Persistent storage with proper schema and indexing
- **Type-Safe API**: Built with tRPC for end-to-end type safety

## API Architecture

This wallet system provides **two API interfaces** for maximum flexibility:

### 1. **REST API** (Recommended for External Integrations)
Clean, standard REST endpoints with simple JSON payloads - perfect for curl, Postman, and third-party integrations.

### 2. **tRPC API** (Used by Web Interface)
Type-safe, modern API used internally by the web interface for optimal developer experience and end-to-end type safety.

---

## REST API Endpoints

### 1. Create Account
- **Endpoint**: `POST /api/account/create`
- **Purpose**: Creates a new user account
- **Input**:
  ```json
  {
    "email": "user@example.com",
    "name": "John Doe"
  }
  ```
- **Output**:
  ```json
  {
    "id": "user_id",
    "email": "user@example.com", 
    "name": "John Doe",
    "balance": 0.00
  }
  ```

### 2. Find User by Email
- **Endpoint**: `POST /api/account/find`
- **Purpose**: Find a user account by email address
- **Input**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Output**:
  ```json
  {
    "id": "user_id",
    "email": "user@example.com", 
    "name": "John Doe",
    "balance": 150.25
  }
  ```

### 3. Top-Up
- **Endpoint**: `POST /api/account/topup`
- **Purpose**: Add balance to a user account
- **Input**:
  ```json
  {
    "userId": "user_id",
    "amount": 100.50,
    "idempotencyKey": "topup_unique_key_123"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "transactionId": "tx_id",
    "newBalance": 100.50,
    "amount": 100.50,
    "duplicate": false
  }
  ```

### 4. Charge
- **Endpoint**: `POST /api/account/charge`
- **Purpose**: Deduct balance from a user account
- **Input**:
  ```json
  {
    "userId": "user_id",
    "amount": 25.75,
    "idempotencyKey": "charge_unique_key_456"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "transactionId": "tx_id",
    "newBalance": 74.75,
    "amount": 25.75,
    "duplicate": false
  }
  ```

### Example curl Commands
```bash
# Create Account
curl -X POST http://localhost:3000/api/account/create \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Find User
curl -X POST http://localhost:3000/api/account/find \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Top-Up
curl -X POST http://localhost:3000/api/account/topup \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_id","amount":100.00,"idempotencyKey":"topup_123"}'

# Charge
curl -X POST http://localhost:3000/api/account/charge \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_id","amount":25.50,"idempotencyKey":"charge_456"}'
```

## Data Considerations

✅ **Currency Precision**: All balances are handled with 2 decimal places precision  
✅ **Negative Balance Prevention**: Balances never go below zero  
✅ **Duplicate Transaction Prevention**: Idempotency keys prevent duplicate operations  
✅ **Database Transactions**: Atomic operations ensure data consistency  

## Setup and Installation

### Prerequisites
- Node.js 18+ 
- pnpm (preferred) or npm

### Installation Steps

1. **Clone/Extract the project**
   ```bash
   cd wallet-system
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Run the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

4. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000) in your browser
   - The test interface will be available immediately
   - The SQLite database (`wallet.sqlite`) will be created automatically

### Database

The SQLite database file (`wallet.sqlite`) will be created in the project root when the application starts. The schema includes:

- **Users table**: Stores user accounts with id, email, name, balance, and timestamps
- **Transactions table**: Audit trail of all top-up and charge operations with idempotency support
- **Indexes**: Optimized for email lookups and transaction queries

### Testing the API

1. **Web Interface (Recommended)**:
   - Navigate to `http://localhost:3000`
   - Use the interactive form interface to test all three endpoints
   - Features include:
     - Real-time balance updates
     - Transaction history display
     - User-friendly forms with validation
     - Error handling with clear messages
     - Beautiful responsive design

2. **Postman Collection**:
   - Import `wallet-system-api.postman_collection.json` into Postman
   - Pre-configured requests for all REST endpoints with clean JSON format
   - Automated test assertions for success/error cases
   - Duplicate transaction testing
   - Edge case validation examples (insufficient funds, invalid amounts)
   - Global variables for seamless workflow testing

3. **Direct curl Commands**:
   - See the curl examples above for direct API testing
   - All endpoints use simple JSON format - no complex nested objects
   - Easy to integrate with any programming language or tool

### Production Build

```bash
pnpm build
pnpm start
# or
npm run build
npm start
```

## Project Structure

```
wallet-system/
├── app/
│   ├── api/
│   │   ├── account/                # REST API endpoints
│   │   │   ├── create/route.ts     # POST /api/account/create
│   │   │   ├── find/route.ts       # POST /api/account/find  
│   │   │   ├── topup/route.ts      # POST /api/account/topup
│   │   │   └── charge/route.ts     # POST /api/account/charge
│   │   └── trpc/[trpc]/route.ts    # tRPC API handler
│   ├── globals.css                 # Tailwind styles
│   ├── layout.tsx                  # Root layout with providers
│   └── page.tsx                    # Main page
├── components/
│   ├── Providers.tsx               # tRPC providers
│   └── WalletDashboard.tsx         # Main dashboard UI
├── lib/
│   ├── database.ts                 # SQLite setup and utilities
│   ├── trpc.ts                     # tRPC router and endpoints
│   └── trpc-client.ts              # Client-side tRPC
├── wallet.sqlite                   # SQLite database (auto-created)
├── wallet-system-api.postman_collection.json  # Postman collection
└── README.md                       # This file
```

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **API**: tRPC for type-safe API communication
- **Database**: SQLite with better-sqlite3
- **Styling**: Tailwind CSS 4
- **TypeScript**: Full type safety throughout
- **Package Manager**: pnpm

## Error Handling

The API implements comprehensive error handling for all edge cases:

### Input Validation Errors
- **Invalid email format**: Validates proper email structure and length (3-255 chars)
- **Empty or whitespace-only fields**: Prevents empty names, user IDs, and other required fields
- **Field length limits**: Name (100 chars), User ID (255 chars), Idempotency key (255 chars)
- **Invalid amounts**: Comprehensive validation for numeric inputs:
  - Must be positive finite numbers
  - Range: $0.01 to $999,999.99
  - Maximum 2 decimal places precision
  - Rejects NaN, Infinity, and non-numeric values

### Business Logic Errors
- **Duplicate email**: Returns 409 Conflict when creating account with existing email
- **User not found**: Returns 404 when user ID doesn't exist
- **Insufficient funds**: Returns 400 Bad Request when charge exceeds balance
- **Duplicate transactions**: Handled gracefully with idempotency keys
- **Race conditions**: Atomic database transactions prevent data inconsistency

### Malformed Request Handling
- **JSON parsing errors**: Clear messages for malformed JSON
- **Missing required fields**: Specific validation messages for each missing field
- **Type mismatches**: Clear indication when wrong data types are provided
- **tRPC format validation**: Ensures proper API call structure

### Enhanced Security
- **SQL injection prevention**: All queries use prepared statements
- **Input sanitization**: Automatic trimming and normalization
- **Rate limiting ready**: Architecture supports rate limiting middleware
- **No sensitive data in errors**: Error messages never expose internal details

The included Postman collection provides comprehensive edge case testing examples.

## Security Considerations

- Input validation with Zod schemas
- SQL injection prevention with prepared statements
- Currency precision handling to prevent rounding errors
- Database transactions for atomicity
- Proper error messages without sensitive data exposure
