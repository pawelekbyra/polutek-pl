import { describe, expect, it } from 'vitest';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';

function getCommentAuthorName(author?: { email?: string | null; name?: string | null; username?: string | null } | null) {
  const rawName = author?.name?.trim();
  const name = (rawName && !isGeneratedClerkUsername(rawName)) ? rawName : null;
  const rawUsername = author?.username?.trim();
  const username = (rawUsername && !isGeneratedClerkUsername(rawUsername)) ? rawUsername : null;
  const fallbackFromEmail = author?.email?.split('@')[0]?.trim();

  return name || username || fallbackFromEmail || "Użytkownik";
}

describe('Comment Name Resolution', () => {
  it('identifies generated Clerk usernames correctly', () => {
    expect(isGeneratedClerkUsername('user_2n9VpX9z9z9z9z9z9z9z9z9z9z9')).toBe(true);
    expect(isGeneratedClerkUsername('user_123456789012')).toBe(true);
    expect(isGeneratedClerkUsername('user_123')).toBe(false); // too short
    expect(isGeneratedClerkUsername('john_doe')).toBe(false);
    expect(isGeneratedClerkUsername('user_name')).toBe(false); // underscores not in [a-z0-9] after user_
  });

  it('prefers name over generated username', () => {
    const author = {
      name: 'Paweł Perfect',
      username: 'user_2n9VpX9z9z9z9z9z9z9z9z9z9z9',
      email: 'pawel@example.com'
    };
    expect(getCommentAuthorName(author)).toBe('Paweł Perfect');
  });

  it('prefers username over email if username is not generated', () => {
    const author = {
      name: 'user_2n9VpX9z9z9z9z9z9z9z9z9z9z9',
      username: 'pawel_p',
      email: 'pawel@example.com'
    };
    expect(getCommentAuthorName(author)).toBe('pawel_p');
  });

  it('falls back to email if name and username are generated', () => {
    const author = {
      name: 'user_2n9VpX9z9z9z9z9z9z9z9z9z9z9',
      username: 'user_3Ea99aSDKtt0UQKIG72VtRSWEtb',
      email: 'jules@agent.com'
    };
    expect(getCommentAuthorName(author)).toBe('jules');
  });

  it('falls back to "Użytkownik" if everything is missing', () => {
    expect(getCommentAuthorName(null)).toBe('Użytkownik');
    expect(getCommentAuthorName({})).toBe('Użytkownik');
  });
});
