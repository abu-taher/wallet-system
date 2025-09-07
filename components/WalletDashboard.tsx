'use client';

import { useState } from 'react';
import { trpc } from '../lib/trpc-client';
import type {
  UserResponse,
  TransactionResponse,
  TransactionHistoryItem,
} from '../lib/types';

export default function WalletDashboard() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<
    { error?: string } | UserResponse | TransactionResponse | null
  >(null);

  const utils = trpc.useUtils();

  const createAccount = trpc.createAccount.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setUserId(data.id);
      utils.getUser.invalidate();
    },
    onError: (error) => {
      setResult({ error: error.message });
    },
  });

  const topUp = trpc.topUp.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.getUser.invalidate();
      utils.getUserTransactions.invalidate();
    },
    onError: (error) => {
      setResult({ error: error.message });
    },
  });

  const charge = trpc.charge.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.getUser.invalidate();
      utils.getUserTransactions.invalidate();
    },
    onError: (error) => {
      setResult({ error: error.message });
    },
  });

  const [shouldSearchUser, setShouldSearchUser] = useState(false);

  const { isFetching: isSearching } = trpc.getUserByEmail.useQuery(
    { email: searchEmail },
    {
      enabled: shouldSearchUser && !!searchEmail,
      onSuccess: (data) => {
        setResult(data);
        setUserId(data.id);
        setShouldSearchUser(false);
        utils.getUser.invalidate();
      },
      onError: (error) => {
        setResult({ error: error.message });
        setShouldSearchUser(false);
      },
    }
  );

  const { data: user } = trpc.getUser.useQuery(
    { userId },
    { enabled: !!userId }
  );

  const { data: transactions } = trpc.getUserTransactions.useQuery(
    { userId },
    { enabled: !!userId }
  );

  const handleCreateAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email && name) {
      createAccount.mutate({ email, name });
    }
  };

  const handleTopUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (userId && amount) {
      const generatedIdempotencyKey =
        Math.random().toString(36).substring(2) + Date.now().toString(36);
      topUp.mutate({
        userId,
        amount: parseFloat(amount),
        idempotencyKey: generatedIdempotencyKey,
      });
    }
  };

  const handleCharge = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (userId && amount) {
      const generatedIdempotencyKey =
        Math.random().toString(36).substring(2) + Date.now().toString(36);
      charge.mutate({
        userId,
        amount: parseFloat(amount),
        idempotencyKey: generatedIdempotencyKey,
      });
    }
  };

  const handleGetUserByEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchEmail) {
      setShouldSearchUser(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Wallet System API
          </h1>
          <p className="text-slate-400 text-lg">
            Test Interface for User Account Management
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          <div className="space-y-6">
            {/* Create Account */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  1
                </span>
                Create Account
              </h2>
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={createAccount.isPending}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] font-medium"
                >
                  {createAccount.isPending ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </div>

            {/* Get User ID by Email */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  2
                </span>
                Find User by Email
              </h2>
              <form onSubmit={handleGetUserByEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Enter email to find user ID"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] font-medium"
                >
                  {isSearching ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Searching...
                    </div>
                  ) : (
                    'Find User'
                  )}
                </button>
              </form>
            </div>

            {/* Top-Up */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  3
                </span>
                Top-Up (Add Balance)
              </h2>
              <form onSubmit={handleTopUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Enter user ID or create account first"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="999999.99"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="0.00"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={topUp.isPending}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] font-medium"
                >
                  {topUp.isPending ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    'Top Up'
                  )}
                </button>
              </form>
            </div>

            {/* Charge */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  4
                </span>
                Charge (Deduct Balance)
              </h2>
              <form onSubmit={handleCharge} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Enter user ID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="999999.99"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="0.00"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={charge.isPending}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] font-medium"
                >
                  {charge.isPending ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    'Charge'
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            {/* Current User Info */}
            {user && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  User Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">ID:</span>
                    <code className="text-slate-300 bg-slate-900/50 px-2 py-1 rounded text-xs">
                      {user.id}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Email:</span>
                    <span className="text-white">{user.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Name:</span>
                    <span className="text-white">{user.name}</span>
                  </div>
                  <div className="border-t border-slate-600 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Balance:</span>
                      <span className="text-2xl font-bold text-green-400">
                        ${user.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Latest Result */}
            {result && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
                  Latest Result
                </h3>
                <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4">
                  <pre className="text-sm text-slate-300 overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Transaction History */}
            {transactions && transactions.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <div className="w-3 h-3 bg-purple-400 rounded-full mr-2"></div>
                  Transaction History
                  <span className="ml-auto text-sm text-slate-400">
                    ({transactions.length})
                  </span>
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {transactions.map((tx: TransactionHistoryItem) => (
                    <div
                      key={tx.id}
                      className="bg-slate-900/30 border border-slate-600 p-4 rounded-lg hover:bg-slate-900/50 transition-all"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center">
                          <div
                            className={
                              tx.type === 'topup'
                                ? 'w-2 h-2 rounded-full mr-2 bg-green-400'
                                : 'w-2 h-2 rounded-full mr-2 bg-red-400'
                            }
                          ></div>
                          <span className="font-medium capitalize text-white">
                            {tx.type}
                          </span>
                        </div>
                        <span
                          className={
                            tx.type === 'topup'
                              ? 'font-bold text-lg text-green-400'
                              : 'font-bold text-lg text-red-400'
                          }
                        >
                          {tx.type === 'topup' ? '+' : '-'}$
                          {tx.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-slate-400 text-sm space-y-1">
                        <p>
                          Balance after:{' '}
                          <span className="text-slate-300">
                            ${tx.balanceAfter.toFixed(2)}
                          </span>
                        </p>
                        <p>{new Date(tx.createdAt).toLocaleString()}</p>
                        {tx.idempotencyKey && (
                          <p>
                            Key:{' '}
                            <code className="bg-slate-700 px-1 rounded text-xs">
                              {tx.idempotencyKey}
                            </code>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* API Documentation */}
        <div className="mt-12 bg-slate-800/30 backdrop-blur-sm border border-slate-700 p-8 rounded-xl shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg mr-3"></div>
            API Endpoints
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/30 border border-slate-600 p-4 rounded-lg hover:bg-slate-900/50 transition-all">
              <h3 className="font-semibold text-white mb-2 flex items-center">
                <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">
                  1
                </span>
                Create Account
              </h3>
              <code className="text-xs bg-slate-800 text-blue-300 px-2 py-1 rounded block mb-2">
                POST /api/trpc/createAccount
              </code>
              <p className="text-slate-400 text-sm">
                Creates a new user account with email and name. Returns user ID
                and initial balance of $0.00.
              </p>
            </div>
            <div className="bg-slate-900/30 border border-slate-600 p-4 rounded-lg hover:bg-slate-900/50 transition-all">
              <h3 className="font-semibold text-white mb-2 flex items-center">
                <span className="bg-purple-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">
                  2
                </span>
                Find User
              </h3>
              <code className="text-xs bg-slate-800 text-purple-300 px-2 py-1 rounded block mb-2">
                GET /api/trpc/getUserByEmail
              </code>
              <p className="text-slate-400 text-sm">
                Finds a user by email address and returns their ID and account
                information.
              </p>
            </div>
            <div className="bg-slate-900/30 border border-slate-600 p-4 rounded-lg hover:bg-slate-900/50 transition-all">
              <h3 className="font-semibold text-white mb-2 flex items-center">
                <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">
                  3
                </span>
                Top-Up
              </h3>
              <code className="text-xs bg-slate-800 text-green-300 px-2 py-1 rounded block mb-2">
                POST /api/trpc/topUp
              </code>
              <p className="text-slate-400 text-sm">
                Adds balance to a user account. Automatically prevents duplicate
                transactions.
              </p>
            </div>
            <div className="bg-slate-900/30 border border-slate-600 p-4 rounded-lg hover:bg-slate-900/50 transition-all">
              <h3 className="font-semibold text-white mb-2 flex items-center">
                <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">
                  4
                </span>
                Charge
              </h3>
              <code className="text-xs bg-slate-800 text-red-300 px-2 py-1 rounded block mb-2">
                POST /api/trpc/charge
              </code>
              <p className="text-slate-400 text-sm">
                Deducts balance from a user account. Prevents negative balances
                and duplicate transactions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
