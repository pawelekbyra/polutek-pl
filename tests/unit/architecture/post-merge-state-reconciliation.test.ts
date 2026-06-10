import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Post-Merge State Reconciliation Invariants', () => {
  const rootDir = process.cwd();
  const readmePath = join(rootDir, 'README.md');
  const guardPath = join(rootDir, 'scripts/check-architecture.ts');

  it('README should not have contradictory R7 status', () => {
    const readme = readFileSync(readmePath, 'utf-8');
    // It should say foundation or certification candidate
    expect(readme).toContain('[~ stronger foundation / certification candidate]');
  });

  it('README should reflect core comments status', () => {
    const readme = readFileSync(readmePath, 'utf-8');
    expect(readme).toContain('[x certified]');
  });

  it('README should correctly report R9 status', () => {
    const readme = readFileSync(readmePath, 'utf-8');
    // R9 is fully certified
    expect(readme).toContain('[x certified]');
  });

  it('Architecture guard should not mark core comment routes as prisma blockers', () => {
    const guard = readFileSync(guardPath, 'utf-8');

    // Core comment routes should be removed from PRISMA_ROUTES_ALLOWLIST
    const forbidden = [
        'app/api/videos/[id]/comments/route.ts',
        'app/api/comments/[commentId]/route.ts',
        'app/api/comments/[commentId]/reaction/route.ts',
        'app/api/comments/[commentId]/report/route.ts'
    ];

    for (const route of forbidden) {
        // We check if it is in the PRISMA_ROUTES_ALLOWLIST object
        const regex = new RegExp(`'${route}':`);
        expect(guard).not.toMatch(regex);
    }
  });

  it('Architecture guard should mark R9 webhook as foundation', () => {
    const guard = readFileSync(guardPath, 'utf-8');
    expect(guard).toContain('R9 certified: migrated to modular email use case.');
  });
});
