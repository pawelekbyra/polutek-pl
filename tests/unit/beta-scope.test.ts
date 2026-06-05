import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const allowedAppRoutes = [
  'app/admin/channel/page.tsx',
  'app/admin/emails/page.tsx',
  'app/admin/page.tsx',
  'app/admin/users/page.tsx',
  'app/admin/videos/page.tsx',
  'app/api/access/route.ts',
  'app/api/admin/channel/route.ts',
  'app/api/admin/creator/route.ts',
  'app/api/admin/stats/route.ts',
  'app/api/admin/templates/route.ts',
  'app/api/admin/users/[userId]/patron/route.ts',
  'app/api/admin/videos/route.ts',
  'app/api/checkout/create-intent/route.ts',
  'app/api/checkout/route.ts',
  'app/api/comments/dislike/route.ts',
  'app/api/comments/like/route.ts',
  'app/api/comments/route.ts',
  'app/api/health/route.ts',
  'app/api/media-source/[videoId]/route.ts',
  'app/api/media/[...path]/route.ts',
  'app/api/subscriptions/route.ts',
  'app/api/user/language/route.ts',
  'app/api/user/profile/route.ts',
  'app/api/user/referrals/claim/route.ts',
  'app/api/user/referrals/route.ts',
  'app/api/user/sync/route.ts',
  'app/api/webhooks/clerk/route.ts',
  'app/api/webhooks/stripe/route.ts',
  'app/channel/[slug]/page.tsx',
  'app/page.tsx',
  'app/polityka-prywatnosci/page.tsx',
  'app/regulamin/page.tsx',
].sort();

function collectRouteFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) return collectRouteFiles(fullPath, root);
    if (entry !== 'page.tsx' && entry !== 'route.ts') return [];

    return relative(process.cwd(), fullPath);
  });
}

describe('private beta route surface', () => {
  it('matches the approved app route allowlist', () => {
    const routes = collectRouteFiles(join(process.cwd(), 'app')).sort();

    expect(routes).toEqual(allowedAppRoutes);
  });
});
