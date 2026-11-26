/** @vitest-environment jsdom */
// One support address everywhere: support@pawelperfect.com. polutek.com is not our domain (parked, for sale), so it must not
// be a contact address anywhere in the code, the checkout, the Premium Zone terms or the i18n catalogs.
import '@testing-library/jest-dom/vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { LEGAL_CONTACT_EMAIL } from '@/app/components/legal/LegalDocs';
import { PassTermsContent } from '@/app/components/premium-pass/PassTermsContent';
import { PATRON_SUPPORT_EMAIL } from '@/app/components/premium-pass/pass-copy';
import { createTx } from '@/lib/i18n/ui';

afterEach(cleanup);

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'apps', 'components', 'lib', 'workers', 'services', 'deploy', 'scripts', 'prisma', 'public'];
const SKIP = new Set(['node_modules', '.next', '.git']);
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|liquid|sh|yml|yaml|html|txt|md|sql)$/;

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (TEXT.test(name)) out.push(full);
  }
}

describe('support address', () => {
  it('the checkout / Premium Zone address is the legal contact address', () => {
    expect(LEGAL_CONTACT_EMAIL).toBe('support@pawelperfect.com');
    expect(PATRON_SUPPORT_EMAIL).toBe(LEGAL_CONTACT_EMAIL);
  });

  it.each(['pl', 'en'] as const)('the Premium Zone terms (%s) print support@pawelperfect.com and no polutek.com address', (locale) => {
    const { container } = render(<PassTermsContent tx={createTx(locale)} locale={locale} demo={false} termsLink={null} />);
    const text = container.textContent ?? '';
    expect(text).toContain(`${locale === 'pl' ? 'Reklamacje i zwroty' : 'Complaints and refunds'}: ${PATRON_SUPPORT_EMAIL}.`);
    expect(text).not.toMatch(/@polutek\.com/i);
  });

  it('no source file, i18n catalog or deploy file uses an @polutek.com address', () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) {
      try {
        walk(path.join(ROOT, dir), files);
      } catch {
        /* directory absent in this checkout */
      }
    }
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => /[\w.+-]+@(?:[\w-]+\.)*polutek\.com\b/i.test(readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
