import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import {
    GetOrCreateUserUseCase,
    GetSubscriptionStatusUseCase,
    SubscribeUseCase,
    UnsubscribeUseCase
} from '@/lib/modules/users';

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

async function requireUser(): Promise<
  | { userId: string; error?: never }
  | { error: NextResponse; userId?: never }
> {
  const actor = await getActorFromAuth();

  if (actor.type === 'guest' || !('userId' in actor)) {
    return { error: NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sign in to manage email notifications.' }, { status: 401 }) };
  }

  const ctx = createAppContext({ actor });
  const { sessionClaims } = await auth();
  const email = (sessionClaims as any)?.email as string;

  await GetOrCreateUserUseCase.execute(ctx, {
      id: actor.userId,
      email,
      name: (sessionClaims as any)?.name,
      username: (sessionClaims as any)?.username,
      imageUrl: (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture
  });

  return { userId: actor.userId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const userResult = await requireUser();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'read');
    if (rateLimited) return rateLimited;

    const ctx = createAppContext({ requestId });
    const result = await GetSubscriptionStatusUseCase.execute(ctx, userResult.userId);

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
    const userResult = await requireUser();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'write');
    if (rateLimited) return rateLimited;

    const ctx = createAppContext({ requestId });
    const result = await SubscribeUseCase.execute(ctx, userResult.userId);

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
    const userResult = await requireUser();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'write');
    if (rateLimited) return rateLimited;

    const ctx = createAppContext({ requestId });
    const result = await UnsubscribeUseCase.execute(ctx, userResult.userId);

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error('[SUBSCRIPTIONS_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
