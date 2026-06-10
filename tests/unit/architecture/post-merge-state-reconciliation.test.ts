import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Post-Merge State Reconciliation Invariants', () => {
  const rootDir = process.cwd();
  const readmePath = path.join(rootDir, 'README.md');
  const guardPath = path.join(rootDir, 'scripts/check-architecture.ts');

  it('README should not have contradictory R7 status', () => {
    const readme = fs.readFileSync(readmePath, 'utf-8');
    // It should say foundation or certification candidate
    expect(readme).toContain('[~ stronger foundation / certification candidate]');
  });

  it('README should reflect core comments status', () => {
    const readme = fs.readFileSync(readmePath, 'utf-8');
    expect(readme).toContain('[x certified]');
  });

  it('README should correctly report R9 status', () => {
    const readme = fs.readFileSync(readmePath, 'utf-8');
    expect(readme).toContain('[~ code-only pass / pending docs+guard reconcile]');
  });

  it('Architecture guard should not mark core comment routes as prisma blockers', () => {
    const guard = fs.readFileSync(guardPath, 'utf-8');

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
    const guard = fs.readFileSync(guardPath, 'utf-8');
    expect(guard).toContain('R9 foundation: migrated to modular email use case.');
  });
});
