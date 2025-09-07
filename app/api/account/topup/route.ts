import { NextRequest, NextResponse } from 'next/server';
import { appRouter, createTRPCContext } from '../../../../lib/trpc';
import { TRPCError } from '@trpc/server';

/**
 * REST API endpoint for adding balance to user accounts
 * POST /api/account/topup
 * 
 * This is a simplified REST wrapper around the tRPC topUp procedure
 * for easier testing with curl, Postman, and external integrations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId || body.amount === undefined || !body.idempotencyKey) {
      return NextResponse.json(
        { 
          error: 'Missing required fields. userId, amount, and idempotencyKey are required.' 
        },
        { status: 400 }
      );
    }

    // Create tRPC context and caller
    const ctx = await createTRPCContext({});
    const caller = appRouter.createCaller(ctx);

    // Call the tRPC procedure
    const result = await caller.topUp({
      userId: body.userId,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    console.error('Top-up REST API error:', error);
    
    if (error instanceof TRPCError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 
        : error.code === 'BAD_REQUEST' ? 400 
        : 500;
      
      return NextResponse.json(
        { error: error.message },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}