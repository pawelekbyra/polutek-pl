import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

function withoutComments(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('access source contract', () => {
  it('keeps patron video access tied to grant status instead of cache flags', () => {
    const code = withoutComments(
      source('lib/modules/access/application/check-video-access.use-case.ts'),
    );

    expect(code).toContain('getPatronStatus');
    expect(code).toContain('activeGrants.length > 0');
    expect(code).not.toMatch(/\bactor\.isPatron\b/);
    expect(code).not.toMatch(/\buser\.isPatron\b/);
    expect(code).not.toMatch(/\buser\.patronSince\b/);
    expect(code).not.toMatch(/\buser\.patronSource\b/);
  });

  it('keeps comment interaction permissions delegated to the video access decision', () => {
    const code = withoutComments(
      source('lib/modules/comments/application/list-video-comments.use-case.ts'),
    );

    expect(code).toContain('checkVideoAccess');
    expect(code).toContain('hasVideoAccess: accessResult.data.hasAccess');
    expect(code).not.toMatch(/\bactor\.isPatron\b/);
    expect(code).not.toMatch(/\buser\.isPatron\b/);
  });
});
