import { auth } from '@clerk/nextjs/server';
import { AppError } from '@/lib/errors';

export function parseJson<T>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new AppError('Invalid JSON input', 400, 'INVALID_JSON');
  }
}

export async function getAuthSession() {
  const { userId, sessionClaims } = await auth();
  return {
    userId,
    role: (sessionClaims?.metadata as any)?.role as string | undefined,
  };
}

export async function requireAdminSession() {
  const session = await getAuthSession();
  if (session.role !== 'admin' && session.role !== 'org:admin') {
    throw new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN');
  }
  return session;
}
