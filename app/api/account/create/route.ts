import { NextRequest, NextResponse } from 'next/server';
import { appRouter, createTRPCContext } from '../../../../lib/trpc';
import { TRPCError } from '@trpc/server';

/**
 * REST API endpoint for creating user accounts
 * POST /api/account/create
 * 
 * This is a simplified REST wrapper around the tRPC createAccount procedure
 * for easier testing with curl, Postman, and external integrations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.email || !body.name) {
      return NextResponse.json(
        { 
          error: 'Missing required fields. Both email and name are required.' 
        },
        { status: 400 }
      );
    }

    // Create tRPC context and caller
    const ctx = await createTRPCContext({});
    const caller = appRouter.createCaller(ctx);

    // Call the tRPC procedure
    const result = await caller.createAccount({
      email: body.email,
      name: body.name,
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error: unknown) {
    console.error('Create account REST API error:', error);
    
    if (error instanceof TRPCError) {
      const statusCode = error.code === 'CONFLICT' ? 409 
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