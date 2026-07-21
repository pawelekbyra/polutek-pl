import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const FORBIDDEN_STRINGS = [
  'sprawdź inne kanały',
  'eksploruj platformę',
  'inni twórcy',
  'creator marketplace',
  'discover creators',
  'explore platform',
  'platforma wideo', // should be 'kanał wideo' or 'serwis'
];

const FILES_TO_CHECK = [
  'app/[locale]/(home)/page.tsx',
  'app/[locale]/channel/[slug]/page.tsx',
  'app/layout.tsx',
  'app/components/LanguageContext.tsx',
  'app/components/Hero.tsx',
  'app/[locale]/regulamin/page.tsx',
  'app/[locale]/polityka-prywatnosci/page.tsx',
  'app/components/channel/DonationBox.tsx',
  'app/admin/users/payments/page.tsx',
  'app/admin/users/[userId]/page.tsx',
  'app/components/playlist/CheckoutModal.tsx',
];

describe('Single-Channel Copy Consistency', () => {
  it('should not contain marketplace or multi-channel suggesting copy in public frontend files', () => {
    FILES_TO_CHECK.forEach(filePath => {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        FORBIDDEN_STRINGS.forEach(forbidden => {
          // We use case-insensitive check but exclude technical strings if necessary.
          // For this pass, we want to be strict on public copy.
          const found = content.toLowerCase().includes(forbidden.toLowerCase());
          expect(found, `File ${filePath} contains forbidden string: "${forbidden}"`).toBe(false);
        });
      }
    });
  });

  it('should use single-channel terminology', () => {
    const pageContent = fs.readFileSync(path.resolve(process.cwd(), 'app/[locale]/(home)/page.tsx'), 'utf8');
    expect(pageContent).toContain('kanał wideo');

    const layoutContent = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.tsx'), 'utf8');
    expect(layoutContent).toContain('niezależny kanał wideo');
  });
});
