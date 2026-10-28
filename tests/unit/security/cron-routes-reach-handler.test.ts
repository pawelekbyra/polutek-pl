import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8');

function cronRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? cronRouteFiles(p) : name === 'route.ts' ? [p] : [];
  });
}

describe('cron routes', () => {
  it('are public in middleware so the systemd cron timers (no session) reach the handler', () => {
    expect(middleware).toContain("'/api/cron/(.*)'");
  });

  it('every cron handler authorizes itself with CRON_SECRET and fails closed', () => {
    const dir = join(root, 'app/api/cron');
    expect(existsSync(dir)).toBe(true);
    const files = cronRouteFiles(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).toContain('CRON_SECRET');
      expect(src, file).toMatch(/!process\.env\.CRON_SECRET/);
      expect(src, file).toContain('status: 401');
    }
  });
});
