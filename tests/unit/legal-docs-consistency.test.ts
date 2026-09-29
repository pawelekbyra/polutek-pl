import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('app/components/legal/LegalDocs.tsx', 'utf8');

function body(fnName: string) {
  const start = source.indexOf(`export function ${fnName}(`);
  const next = source.indexOf('\nexport function ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('legal documents consistency', () => {
  const docs = ['RegulaminContent', 'PolitykaContent', 'TermsContentEn', 'PrivacyContentEn'];

  it('every document names the same operator, address and contact email', () => {
    expect(source).toContain("export const LEGAL_CONTACT_EMAIL = 'hello@pawelperfect.pl';");
    for (const doc of docs) {
      const text = body(doc);
      expect(text, doc).toContain('Paweł Perfect');
      expect(text, doc).toContain('Złota 75');
      expect(text, doc).toContain('LEGAL_CONTACT_EMAIL');
    }
  });

  it('no document mentions the former LLC or a separate contact address', () => {
    expect(source).not.toMatch(/Kutashi|kutashi|LLC ID|EIN/);
  });

  it('the privacy policy does not describe support as buying access or mention complaints', () => {
    for (const doc of ['PolitykaContent', 'PrivacyContentEn']) {
      const text = body(doc);
      expect(text, doc).not.toMatch(/obsługa dostępu|handling access|reklamacj|complaint handling|confirmations of payments, access/);
    }
  });
});
