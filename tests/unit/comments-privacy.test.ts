import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { toPublicCommentAuthor } from '@/lib/comments-public-author';

describe('comments privacy helpers', () => {
  it('does not expose private author email or referral points in public comment payloads', () => {
    const publicAuthor = toPublicCommentAuthor({
      id: 'user-1',
      name: 'Komentator',
      username: 'komentator',
      imageUrl: 'https://img.example/avatar.png',
      isPatron: true,
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
      badges: ['PATRON'],
    });
    expect(publicAuthor).not.toHaveProperty('email');
    expect(publicAuthor).not.toHaveProperty('referralPoints');
  });

  it('keeps email out of the client author type and avatar seed logic', () => {
    const source = readFileSync('app/components/comments/types.ts', 'utf8');
    const avatarSeedBlock = source.slice(
      source.indexOf('export function getAvatarSeed'),
      source.indexOf('export function isPatronAuthor'),
    );

    expect(source).not.toContain('email?: string | null');
    expect(avatarSeedBlock).not.toContain('email');
    expect(avatarSeedBlock).toContain('comment.author?.username');
  });
});
