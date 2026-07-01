import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Referral Decommissioning Regression Test (Source Contract)
 *
 * This test ensures that the referral/invitation mechanism decommissioned in #1040
 * is not accidentally reintroduced. Instead of importing runtime modules (which
 * violates architecture boundaries), it inspects the source code directly.
 */
describe('Referral Decommissioning Source Contract', () => {
  const readFile = (relPath: string) => {
    try {
      return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
    } catch (e) {
      return ''; // Handle missing files gracefully in tests
    }
  };

  it('lib/modules/users/application/sync-user-from-webhook.use-case.ts no longer includes referrerId', () => {
    const content = readFile('lib/modules/users/application/sync-user-from-webhook.use-case.ts');
    expect(content).not.toContain('referrerId');
  });

  it('lib/modules/users/application/sync-user.use-case.ts no longer reads unsafeMetadata.referrerId', () => {
    const content = readFile('lib/modules/users/application/sync-user.use-case.ts');
    expect(content).not.toContain('unsafeMetadata.referrerId');
    // Note: referrerId remains in DB migration logic (merging records), but not in Clerk sync
    expect(content).not.toContain('const referrerId =');
    expect(content).not.toContain('clerkUser.unsafeMetadata.referrerId');
  });

  it('lib/modules/users/application/sync-user.use-case.ts no longer writes referredBy', () => {
    const content = readFile('lib/modules/users/application/sync-user.use-case.ts');
    expect(content).not.toContain('referredBy');
  });

  it('app/api/webhooks/clerk/route.ts no longer passes referrerId', () => {
    const content = readFile('app/api/webhooks/clerk/route.ts');
    expect(content).not.toContain('referrerId');
  });

  it('lib/modules/users/index.ts no longer exports claim-referral.use-case', () => {
    const content = readFile('lib/modules/users/index.ts');
    expect(content).not.toContain('claim-referral.use-case');
  });

  it('app/components/channel/DonationBox.tsx no longer imports ReferralModal or ReferralInfo', () => {
    const content = readFile('app/components/channel/DonationBox.tsx');
    expect(content).not.toContain('ReferralModal');
    expect(content).not.toContain('ReferralInfo');
  });

  it('ensures claim-referral.use-case.ts file is deleted', () => {
     const exists = fs.existsSync(path.join(process.cwd(), 'lib/modules/users/application/claim-referral.use-case.ts'));
     expect(exists).toBe(false);
  });
});
