import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Post-Merge State Reconciliation Invariants', () => {
  const rootDir = process.cwd();
  const readmePath = join(rootDir, 'README.md');
  const projectStatePath = join(rootDir, 'docs/PROJECT-STATE.md');
  const masterplanPath = join(rootDir, 'docs/MASTERPLAN.md');
  const ticketQueuePath = join(rootDir, 'docs/tickets/ready/README.md');
  const reportsIndexPath = join(rootDir, 'docs/reports/reconciliation/README.md');
  const guardPath = join(rootDir, 'scripts/check-architecture.ts');

  const readText = (path: string) => readFileSync(path, 'utf-8');

  it('README presents Polutek.pl as an active product after stabilization', () => {
    const readme = readText(readmePath);

    expect(readme).toContain('# Polutek.pl');
    expect(readme).toContain('aktywny produkt');
    expect(readme).toContain('zakończonej stabilizacji');
    expect(readme).toContain('Polutek.pl is not a platform.');
    expect(readme).toContain('Polutek.pl is a place.');
    expect(readme).not.toContain('Current Main Control Panel');
    expect(readme).not.toContain('Public launch: `NO_GO`');
  });

  it('PROJECT-STATE records completed major refactor and stabilization', () => {
    expect(existsSync(projectStatePath)).toBe(true);
    const projectState = readText(projectStatePath);

    expect(projectState).toContain('STABILIZACJA ZAKOŃCZONA');
    expect(projectState).toContain('Duży refaktor i stabilizacja fundamentów produktu są zakończone.');
    expect(projectState).toContain('aktywnego dużego ticketu kodowego');
  });

  it('MASTERPLAN identifies stabilized active product mode', () => {
    const masterplan = readText(masterplanPath);

    expect(masterplan).toContain('STABILIZACJA ZAKOŃCZONA / AKTYWNY PRODUKT');
    expect(masterplan).toContain('Brak aktywnego dużego ticketu kodowego');
  });

  it('ready queue declares no active large code ticket', () => {
    const ticketQueue = readText(ticketQueuePath);

    expect(ticketQueue).toContain('nie ma aktywnego dużego ticketu kodowego');
    expect(ticketQueue).toContain('<!-- CONTROL_PLANE_CURRENT_TICKET_ID: NONE -->');
    expect(ticketQueue).toContain('<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: NONE -->');
    expect(ticketQueue).toContain('NO_ACTIVE_LARGE_CODE_TICKET');
  });

  it('historical reports remain linked and preserved', () => {
    const readme = readText(readmePath);
    const projectState = readText(projectStatePath);
    const reportsIndex = readText(reportsIndexPath);

    expect(readme).toContain('docs/reports/reconciliation/README.md');
    expect(projectState).toContain('docs/reports/reconciliation/');
    expect(reportsIndex).toContain('POST-931-CI-SIGNAL-RESTORATION-RECONCILIATION.md');
    expect(reportsIndex).toContain('remain historical point-in-time evidence');
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
