import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';

type SubscriptionPayload = {
  creatorId?: unknown;
  creatorSlug?: unknown;
};

function normalizeCreatorRef(payload: SubscriptionPayload, url: URL) {
  const bodyCreatorId = typeof payload.creatorId === 'string' ? payload.creatorId.trim() : '';
  const bodyCreatorSlug = typeof payload.creatorSlug === 'string' ? payload.creatorSlug.trim() : '';
  const queryCreatorId = url.searchParams.get('creatorId')?.trim() || '';
  const queryCreatorSlug = url.searchParams.get('creatorSlug')?.trim() || '';

  return {
    creatorId: bodyCreatorId || queryCreatorId || null,
    creatorSlug: bodyCreatorSlug || queryCreatorSlug || null,
  };
}

async function readJsonPayload(req: NextRequest): Promise<SubscriptionPayload> {
  if (!req.body) return {};

  try {
    const json = await req.json();
    return json && typeof json === 'object' ? json as SubscriptionPayload : {};
  } catch {
    return {};
  }
}

async function resolveCreator(creatorId: string | null, creatorSlug: string | null): Promise<
  | { creator: { id: string; slug: string; isApproved: boolean }; error?: never }
  | { error: NextResponse; creator?: never }
> {
  if (!creatorId && !creatorSlug) {
    return { error: NextResponse.json({ error: 'CREATOR_REQUIRED', message: 'creatorId or creatorSlug is required.' }, { status: 400 }) };
  }

  const creator = creatorId
    ? await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true, slug: true, isApproved: true } })
    : await prisma.creator.findUnique({ where: { slug: creatorSlug as string }, select: { id: true, slug: true, isApproved: true } });

  if (!creator || !creator.isApproved) {
    return { error: NextResponse.json({ error: 'CREATOR_NOT_FOUND', message: 'Creator not found.' }, { status: 404 }) };
  }

  return { creator };
}


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

    const url = new URL(req.url);
    const { creatorId, creatorSlug } = normalizeCreatorRef({}, url);
    const creatorResult = await resolveCreator(creatorId, creatorSlug);
    if (creatorResult.error) return creatorResult.error;

    const subscription = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId: userResult.userId, creatorId: creatorResult.creator.id } },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      isSubscribed: !!subscription,
      subscribedAt: subscription?.createdAt ?? null,
      creatorId: creatorResult.creator.id,
      creatorSlug: creatorResult.creator.slug,
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

    const url = new URL(req.url);
    const payload = await readJsonPayload(req);
    const { creatorId, creatorSlug } = normalizeCreatorRef(payload, url);
    const creatorResult = await resolveCreator(creatorId, creatorSlug);
    if (creatorResult.error) return creatorResult.error;

    const subscription = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { userId_creatorId: { userId: userResult.userId, creatorId: creatorResult.creator.id } },
        select: { id: true, createdAt: true },
      });

      if (existing) return existing;

      const created = await tx.subscription.create({
        data: { userId: userResult.userId, creatorId: creatorResult.creator.id },
        select: { id: true, createdAt: true },
      });

      await tx.creator.update({
        where: { id: creatorResult.creator.id },
        data: { subscribersCount: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json({
      isSubscribed: true,
      subscribedAt: subscription.createdAt,
      creatorId: creatorResult.creator.id,
      creatorSlug: creatorResult.creator.slug,
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

    const url = new URL(req.url);
    const payload = await readJsonPayload(req);
    const { creatorId, creatorSlug } = normalizeCreatorRef(payload, url);
    const creatorResult = await resolveCreator(creatorId, creatorSlug);
    if (creatorResult.error) return creatorResult.error;

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.subscription.deleteMany({
        where: { userId: userResult.userId, creatorId: creatorResult.creator.id },
      });

      if (deleted.count > 0) {
        await tx.creator.updateMany({
          where: { id: creatorResult.creator.id, subscribersCount: { gt: 0 } },
          data: { subscribersCount: { decrement: 1 } },
        });
      }

      return deleted;
    });

    return NextResponse.json({
      isSubscribed: false,
      deleted: result.count > 0,
      creatorId: creatorResult.creator.id,
      creatorSlug: creatorResult.creator.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
      message: 'Email notifications disabled for this channel.',
    });
  } catch (error) {
    scopedLogger.error('[SUBSCRIPTIONS_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
