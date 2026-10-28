import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('/[locale]/channel/[slug] page', () => {
  it('keeps /channel/[MAIN_CREATOR_SLUG] active when ENABLE_MULTI_CREATOR=false instead of redirecting to homepage', () => {
    process.env.ENABLE_MULTI_CREATOR = 'false';

    const source = readFileSync(join(process.cwd(), 'app/[locale]/channel/[slug]/page.tsx'), 'utf8');

    expect(source).toContain('getChannelHeaderCached(params.slug)');
    expect(source).not.toMatch(/redirect\(['"]\/['"]\)/);
    expect(source).not.toContain('flags.multiCreator');
  });
});
