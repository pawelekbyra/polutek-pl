import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Post-Merge State Reconciliation Invariants', () => {
  const rootDir = process.cwd();
  const readmePath = join(rootDir, 'README.md');
  const guardPath = join(rootDir, 'scripts/check-architecture.ts');

  const readText = (path: string) => readFileSync(path, 'utf-8');

  it('README identifies the current Post-R owner control panel state', () => {
    const readme = readText(readmePath);

    expect(readme).toContain('# Polutek.pl — Post-R AI Delivery Control Panel');
    expect(readme).toContain('Post-R AI Delivery Control Plane jest aktywny.');
    expect(readme).toContain('Nie oznacza launch-ready');
  });

  it('README points agents to the active contract and one-ticket workflow', () => {
    const readme = readText(readmePath);

    expect(readme).toContain('Kontrakt agentów: `AGENTS.md`.');
    expect(readme).toContain('`AGENTS.md` jest aktywnym kontraktem agentów AI.');
    expect(readme).toContain('Jeden ticket = jeden agent task = jeden branch = jeden PR.');
  });

  it('README blocks stale PR merge instructions instead of reviving them', () => {
    const readme = readText(readmePath);

    expect(readme).toContain('#817 powinien zostać zamknięty');
    expect(readme).toContain('#814 powinien zostać zamknięty');
    expect(readme).toContain('Nie merge’ować #817 ani #814');
    expect(readme).not.toMatch(/(?:^|\n)\s*(?:merge|merge’ować)\s+#(?:817|814)\b/i);
  });

  it('Architecture guard remains readable and enforces current boundary categories', () => {
    const guard = readText(guardPath);

    expect(guard).toContain('const FORBIDDEN_IMPORTS = [');
    expect(guard).toContain("'next/server'");
    expect(guard).toContain("'@clerk/nextjs'");
    expect(guard).toContain("const CLOSED_MODULES = ['video', 'users', 'channel', 'audit', 'media', 'access', 'comments', 'subscriptions'];");
    expect(guard).toContain('const ROUTE_SERVICE_IMPORT_ALLOWLIST: Record<string, string> = {');
    expect(guard).toContain('const PRISMA_ROUTES_ALLOWLIST: Record<string, string> = {};');
    expect(guard).toContain('process.exit(1)');
    expect(guard).toContain('✅ Architecture check passed.');
  });

  it('Architecture guard does not re-allow core comment route Prisma bypasses', () => {
    const guard = readText(guardPath);
    const forbiddenPrismaBypassRoutes = [
      'app/api/videos/[id]/comments/route.ts',
      'app/api/comments/[commentId]/route.ts',
      'app/api/comments/[commentId]/reaction/route.ts',
      'app/api/comments/[commentId]/report/route.ts',
    ];

    for (const route of forbiddenPrismaBypassRoutes) {
      expect(guard).not.toContain(`'${route}':`);
    }
  });
});
