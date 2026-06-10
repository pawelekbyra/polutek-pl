import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { GetOrCreateUserUseCase } from '@/lib/modules/users';
import { GetSubscriptionStatusUseCase, SubscribeUseCase, UnsubscribeUseCase } from "@/lib/modules/subscriptions";

export const dynamic = 'force-dynamic';

async function enforceSubscriptionRateLimit(userId: string, action: 'read' | 'write') {
  const limit = action === 'read' ? 120 : 20;
  const windowMs = action === 'read' ? 60 * 1000 : 10 * 60 * 1000;
  const result = await rateLimit({
    key: `subscriptions:${action}:${userId}`,
    limit,
    windowMs,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many subscription requests. Please try again later.' },
      { status: 429 },
    );
  }

  return null;
}

async function requireUserAndGetContext() {
  const actor = await getActorFromAuth();

  if (actor.type === 'guest' || actor.type === 'system') {
    return { error: NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sign in to manage email notifications.' }, { status: 401 }) };
  }

  const ctx = createAppContext({
    actor,
    requestId: getCorrelationId() ?? undefined
  });

  const { sessionClaims } = await auth();
  const email = (sessionClaims as any)?.email as string;

  await GetOrCreateUserUseCase.execute(ctx, {
      id: actor.userId,
      email,
      name: (sessionClaims as any)?.name,
      username: (sessionClaims as any)?.username,
      imageUrl: (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture
  });

  return { ctx, userId: actor.userId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const userResult = await requireUserAndGetContext();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'read');
    if (rateLimited) return rateLimited;

    const result = await GetSubscriptionStatusUseCase.execute(userResult.ctx);

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error('[SUBSCRIPTIONS_GET_ERROR]', error);
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const userResult = await requireUserAndGetContext();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'write');
    if (rateLimited) return rateLimited;

    const result = await SubscribeUseCase.execute(userResult.ctx);

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error('[SUBSCRIPTIONS_POST_ERROR]', error);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const userResult = await requireUserAndGetContext();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'write');
    if (rateLimited) return rateLimited;

    const result = await UnsubscribeUseCase.execute(userResult.ctx);

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error('[SUBSCRIPTIONS_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
