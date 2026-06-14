import { auth } from '@clerk/nextjs/server';
import { AppError } from '@/lib/errors';
import { Actor } from '@/lib/modules/shared/actor';

export async function getAuthSession() {
  const { userId, sessionClaims } = await auth();
  return {
    userId,
    role: (sessionClaims?.metadata as
any)?.role as string | undefined,
    isPatron: (sessionClaims?.metadata as
any)?.isPatron as boolean | undefined,
  };
}

export async function requireAdminSession() {
  const session = await getAuthSession();
  if (session.role !== 'admin' && session.role !== 'org:admin') {
    throw new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN');
  }
  return session;
}

/**
 * Builds an Actor from the current Clerk session.
 *
 * IMPORTANT: actor.isPatron reflects Clerk session metadata — a cache, not the DB.
 * For any access-control decision involving patron status, resolve the actor's
 * actual DB state via getUserAccessProfile() from @/lib/modules/users.
 * Do NOT rely on actor.isPatron for paywall enforcement.
 */
export async function getActorFromAuth(): Promise<Actor> {
    const session = await getAuthSession();
    if (!session.userId) return { type: 'guest' };
    if (session.role === 'admin' || session.role === 'org:admin') return { type: 'admin', userId: session.userId };
    // WARNING: isPatron here comes from Clerk session cache.
    // For access-control decisions, always verify against DB via getUserAccessProfile().
    return { type: 'user', userId: session.userId, isPatron: !!session.isPatron };
}
