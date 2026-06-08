import { auth } from '@clerk/nextjs/server';
import { AppError } from '@/lib/errors';
import { Actor } from '@/lib/modules/shared/actor';

export async function getAuthSession() {
  const { userId, sessionClaims } = await auth();
  return {
    userId,
    role: (sessionClaims?.metadata as any)?.role as string | undefined,
    isPatron: (sessionClaims?.metadata as any)?.isPatron as boolean | undefined,
  };
}

export async function requireAdminSession() {
  const session = await getAuthSession();
  if (session.role !== 'admin' && session.role !== 'org:admin') {
    throw new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN');
  }
  return session;
}

export async function getActorFromAuth(): Promise<Actor> {
    const session = await getAuthSession();
    if (!session.userId) return { type: 'guest' };
    if (session.role === 'admin' || session.role === 'org:admin') return { type: 'admin', userId: session.userId };
    return { type: 'user', userId: session.userId, isPatron: !!session.isPatron };
}
