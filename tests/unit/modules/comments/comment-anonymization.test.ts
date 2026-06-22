import { describe, it, expect } from 'vitest';
import { toPublicCommentAuthor } from '@/lib/comments-public-author';

describe('Comment Anonymization Rendering', () => {
  it('renders a soft-deleted user as neutral "Usunięty Użytkownik" without PII', () => {
    // Simulated soft-deleted user data as it would come from the database
    const softDeletedUser = {
      id: 'user_deleted_123',
      name: 'Usunięty Użytkownik',
      username: 'deleted_abc123',
      email: 'deleted_uuid@deleted.com',
      imageUrl: null,
      isPatron: false,
      role: 'USER' as const,
    };

    const authorDto = toPublicCommentAuthor(softDeletedUser);

    expect(authorDto).not.toBeNull();
    expect(authorDto?.displayName).toBe('Usunięty Użytkownik');
    // username is kept for internal identification but should be neutral/anonymized
    expect(authorDto?.username).toBe('deleted_abc123');
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
      role: 'USER' as const,
    };

    const authorDto = toPublicCommentAuthor(userWithClerkUsername);
    expect(authorDto?.displayName).toBe('Użytkownik');
  });
});
