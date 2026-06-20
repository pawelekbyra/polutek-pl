import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Post-Merge State Reconciliation Invariants', () => {
  const rootDir = process.cwd();
  const readmePath = join(rootDir, 'README.md');
  const ticketQueuePath = join(rootDir, 'docs/tickets/ready/README.md');
  const guardPath = join(rootDir, 'scripts/check-architecture.ts');

  const readText = (path: string) => readFileSync(path, 'utf-8');

  it('README identifies the current control-plane state', () => {
    const readme = readText(readmePath);

    expect(readme).toContain('# Polutek.pl — Current Main Control Panel');
    expect(readme).toContain('ACTIVE — POST-R AI DELIVERY CONTROL PLANE');
    expect(readme).toContain('Public launch: `NO_GO`');
    expect(readme).toContain('Implementation foundation: substantial.');
    expect(readme).toContain('Automated CI debt: security remediation merged via #946, hotspot debt via #950, and coverage baseline debt via #953.');
    expect(readme).toContain('Public launch: NO_GO / not certified.');
  });

  it('README points agents to canonical control-plane sources', () => {
    const readme = readText(readmePath);

    expect(readme).toContain('AGENTS.md');
    expect(readme).toContain('docs/strategy/OWNER-DECISIONS.md');
    expect(readme).toContain('docs/tickets/ready/README.md');
    expect(readme).toContain('docs/roadmap/Launch-Execution-Backlog.md');
  });

  it('README delegates the current ticket pointer to the canonical queue', () => {
    const readme = readText(readmePath);
    const ticketQueue = readText(ticketQueuePath);

    expect(readme).toContain('The sole canonical current-ticket pointer is maintained in `docs/tickets/ready/README.md`.');
    expect(readme).toContain('This README intentionally does not duplicate the current ticket ID.');
    expect(readme).toContain('docs/tickets/ready/README.md');
    expect(readme).not.toContain('Exactly one current executable ticket:');
    expect(readme).not.toContain('LAUNCH-CERTIFICATION-AFTER-CI-DEBT-CLOSURE-001');
    expect(readme).not.toContain('OWNER-LAUNCH-DECISIONS-001 — Consolidate launch-blocking owner decisions');

    expect(ticketQueue).toContain('<!-- CONTROL_PLANE_CURRENT_TICKET_ID: X3-FIX-008 -->');
    expect(ticketQueue).toContain('Only the row above is the current-primary executable row.');
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