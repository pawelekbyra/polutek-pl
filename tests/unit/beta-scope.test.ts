import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenProductRoutes = [
  'app/campaign/page.tsx',
  'app/zrzutka/page.tsx',
  'app/crowdfunding/page.tsx',
  'app/fundraising/page.tsx',
  'app/api/campaign/route.ts',
  'app/api/zrzutka/route.ts',
  'app/api/crowdfunding/route.ts',
  'app/api/fundraising/route.ts',
];

describe('private beta product scope', () => {
  it('ships no active campaign/zrzutka/crowdfunding/fundraising route', () => {
    const repoRoot = process.cwd();
    const activeRoutes = forbiddenProductRoutes.filter((route) => existsSync(join(repoRoot, route)));

    expect(activeRoutes).toEqual([]);
  });
});
