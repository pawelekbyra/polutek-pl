import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: vi.fn(), currentUser: vi.fn() }));

import { pickClaimsDisplayName } from '@/lib/modules/users/application/sync-user.use-case';

describe('pickClaimsDisplayName', () => {
  it('keeps the stored nickname over the (generated) username', () => {
    expect(pickClaimsDisplayName({ existingName: 'Dupek z Piekłą Rodem', displayUsername: 'dupek_z_piekla_rodem_bmwape' }))
      .toBe('Dupek z Piekłą Rodem');
  });
  it('still prefers a name carried by the token', () => {
    expect(pickClaimsDisplayName({ claimName: 'From Token', existingName: 'Old', displayUsername: 'u' })).toBe('From Token');
    expect(pickClaimsDisplayName({ firstName: 'Ann', lastName: 'B', existingName: 'Old' })).toBe('Ann B');
  });
  it('falls back to the username, then the e-mail name, when nothing is stored', () => {
    expect(pickClaimsDisplayName({ displayUsername: 'nick_name' })).toBe('nick_name');
    expect(pickClaimsDisplayName({ fallbackEmailName: 'hello' })).toBe('hello');
    expect(pickClaimsDisplayName({})).toBeNull();
  });
});
