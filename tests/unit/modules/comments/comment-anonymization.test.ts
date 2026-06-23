import { describe, it, expect } from 'vitest';
import { toPublicCommentAuthor } from '@/lib/comments-public-author';

describe('Comment Anonymization Rendering', () => {
  it('renders a soft-deleted user as neutral "Usunięty Użytkownik" without PII', () => {
    // Simulated soft-deleted user data as it would come from the database
    const softDeletedUser = {
      id: 'user_deleted_123',
      name: 'Old Name',
      username: 'old_username',
      email: 'old@example.com',
      imageUrl: 'https://example.com/avatar.png',
      isPatron: true,
      isDeleted: true,
      role: 'USER' as const,
    };

    const authorDto = toPublicCommentAuthor(softDeletedUser);

    expect(authorDto).not.toBeNull();
    expect(authorDto?.displayName).toBe('Usunięty Użytkownik');
    // username must be null for deleted users
    expect(authorDto?.username).toBeNull();
    expect(authorDto?.imageUrl).toBeNull();
    expect(authorDto?.badges).toHaveLength(0);
  });

  it('renders a user with no name or username as "Użytkownik" (basic fallback)', () => {
    const anonymousUser = {
      id: 'u1',
      name: null,
      username: null,
      email: 'john@example.com',
      imageUrl: null,
      isPatron: false,
      isDeleted: false,
      role: 'USER' as const,
    };

    const authorDto = toPublicCommentAuthor(anonymousUser);
    expect(authorDto?.displayName).toBe('Użytkownik');
  });

  it('ensures that generated Clerk usernames are treated as missing for displayName', () => {
    const userWithClerkUsername = {
      id: 'u1',
      name: 'user_2n9VpX9z9z9z9z9z9z9z9z9z9z9', // Clerk auto-generated
      username: 'user_2n9VpX9z9z9z9z9z9z9z9z9z9z9',
      email: 'john@example.com',
      imageUrl: null,
      isPatron: false,
      isDeleted: false,
      role: 'USER' as const,
    };

    const authorDto = toPublicCommentAuthor(userWithClerkUsername);
    expect(authorDto?.displayName).toBe('Użytkownik');
  });
});
