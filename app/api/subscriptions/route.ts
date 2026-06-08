import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';
import { MainChannelService } from '@/lib/channel/main-channel.service';

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
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return { error: NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sign in to manage email notifications.' }, { status: 401 }) };
  }

  if (typeof UserService.getOrCreateUserFromAuth === 'function') {
    await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
  } else {
    await UserService.getOrCreateUser(userId);
  }
  return { userId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const userResult = await requireUser();
    if (userResult.error) return userResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(userResult.userId, 'read');
    if (rateLimited) return rateLimited;

    const mainChannel = await MainChannelService.getRequired();

    const [subscription, creator] = await Promise.all([
        prisma.subscription.findUnique({
          where: { userId_creatorId: { userId: userResult.userId, creatorId: mainChannel.id } },
          select: { id: true, createdAt: true },
        }),
        prisma.creator.findUnique({
            where: { id: mainChannel.id },
            select: { subscribersCount: true }
        })
    ]);

    return NextResponse.json({
      isSubscribed: !!subscription,
      subscribedAt: subscription?.createdAt ?? null,
      subscribersCount: creator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
    });
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

    const mainChannel = await MainChannelService.getRequired();

    const subscription = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { userId_creatorId: { userId: userResult.userId, creatorId: mainChannel.id } },
        select: { id: true, createdAt: true },
      });

      if (existing) return existing;

      const created = await tx.subscription.create({
        data: { userId: userResult.userId, creatorId: mainChannel.id },
        select: { id: true, createdAt: true },
      });

      await tx.creator.update({
        where: { id: mainChannel.id },
        data: { subscribersCount: { increment: 1 } },
      });

      return created;
    });

    const finalCreator = await prisma.creator.findUnique({ where: { id: mainChannel.id }, select: { subscribersCount: true } });

    return NextResponse.json({
      isSubscribed: true,
      subscribedAt: subscription.createdAt,
      subscribersCount: finalCreator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
      message: 'Email notifications enabled for this channel.',
    });
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

    const mainChannel = await MainChannelService.getRequired();

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.subscription.deleteMany({
        where: { userId: userResult.userId, creatorId: mainChannel.id },
      });

      if (deleted.count > 0) {
        await tx.creator.updateMany({
          where: { id: mainChannel.id, subscribersCount: { gt: 0 } },
          data: { subscribersCount: { decrement: 1 } },
        });
      }

      return deleted;
    });

    const finalCreator = await prisma.creator.findUnique({ where: { id: mainChannel.id }, select: { subscribersCount: true } });

    return NextResponse.json({
      isSubscribed: false,
      deleted: result.count > 0,
      subscribersCount: finalCreator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
      message: 'Email notifications disabled for this channel.',
    });
  } catch (error) {
    scopedLogger.error('[SUBSCRIPTIONS_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
