import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toPublicCommentAuthor } from '@/lib/comments-public-author';

describe('comments privacy helpers', () => {
  it('does not expose private author email or referral points in public comment payloads', () => {
    const publicAuthor = toPublicCommentAuthor({
      id: 'user-1',
      name: 'Komentator',
      username: 'komentator',
      imageUrl: 'https://img.example/avatar.png',
      patronGrants: [{ id: 'grant-1' }],
      isDeleted: false,
      role: 'USER',
      email: 'private@example.com',
      referralPoints: 999,
    } as any);

    expect(publicAuthor).toEqual({
      id: 'user-1',
      displayName: 'Komentator',
      username: 'komentator',
      imageUrl: 'https://img.example/avatar.png',
      // No supporter badge in public payloads (owner decision 2026-10-04).
      badges: [],
    });
    expect(publicAuthor).not.toHaveProperty('email');
    expect(publicAuthor).not.toHaveProperty('referralPoints');
  });

  it('keeps email out of the client author type', () => {
    const source = readFileSync('app/components/comments/types.ts', 'utf8');
    expect(source).not.toContain('email?: string | null');
  });
});
