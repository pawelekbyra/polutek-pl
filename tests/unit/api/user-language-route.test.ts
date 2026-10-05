import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/user/language/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
vi.mock('@/lib/auth/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/api/auth', () => ({ getActorFromAuth: vi.fn().mockResolvedValue({ type: 'user', userId: 'user_1' }) }));
vi.mock('@/lib/logger', () => {
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: log, createScopedLogger: () => log };
});

const userId = 'user_1';

function patch(body: string) {
  return PATCH(new NextRequest('https://www.pawelperfect.com/api/user/language', { method: 'PATCH', body }));
}

describe('PATCH /api/user/language (the one place a signed-in language is saved)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId } as never);
  });

  it('stores the language on the user row without touching the rest of the profile', async () => {
    const stored = { id: userId, email: 'a@example.com', name: 'Ania', imageUrl: '/default-avatar.jpg', language: 'en', isDeleted: false };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(stored as never);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ ...stored, language: 'pl' } as never);

    const response = await patch(JSON.stringify({ language: 'pl' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const call = vi.mocked(prisma.user.upsert).mock.calls[0]![0];
    expect(call.where).toEqual({ id: userId });
    expect(call.update).toMatchObject({ language: 'pl' });
    const update = call.update as Record<string, unknown>;
    expect(update.name).toBeUndefined();
    expect(update.imageUrl).toBeUndefined();
  });

  it.each([['{"language":"ja"}'], ['{"language":"PL"}'], ['{}'], ['not json']])('refuses %s with 400 and writes nothing', async (body) => {
    const response = await patch(body);
    expect(response.status).toBe(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('answers 401 to a guest', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const response = await patch(JSON.stringify({ language: 'pl' }));
    expect(response.status).toBe(401);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('never writes the language of a deleted account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: userId, isDeleted: true } as never);
    const response = await patch(JSON.stringify({ language: 'pl' }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
