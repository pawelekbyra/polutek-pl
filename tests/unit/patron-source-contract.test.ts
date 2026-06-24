import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const source = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

function stripComments(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('patron source contract', () => {
  it('keeps patron video gating tied to grant lookup instead of cached user fields', () => {
    const accessSource = stripComments(source('lib/modules/access/application/check-video-access.use-case.ts'));
    const blockStart = accessSource.indexOf('if (video.tier === AccessTier.PATRON)');
    const blockEnd = accessSource.indexOf('return ok({ hasAccess: false, reason: "FORBIDDEN" });', blockStart);
    const patronBlock = accessSource.slice(blockStart, blockEnd);
    const cacheFlag = ['is', 'Patron'].join('');
    const cacheSince = ['patron', 'Since'].join('');
    const cacheSource = ['patron', 'Source'].join('');

    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(patronBlock).toContain('getPatronStatus');
    expect(patronBlock).not.toContain(`.${cacheFlag}`);
    expect(patronBlock).not.toContain(`.${cacheSince}`);
    expect(patronBlock).not.toContain(`.${cacheSource}`);
  });
});
