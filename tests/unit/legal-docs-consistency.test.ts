import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  LEGAL_CONTACT_EMAIL,
  PolitykaContent,
  PrivacyContentEn,
  RegulaminContent,
  TermsContentEn,
} from '@/app/components/legal/LegalDocs';
import { SESSION_COOKIE_PREFIX, SESSION_EXPIRES_IN_SECONDS } from '@/lib/auth/config';
import { UNVERIFIED_ACCOUNT_RETENTION_DAYS } from '@/lib/auth/prune-unverified';
import { AUTHOR_DELETED_COMMENT_RETENTION_DAYS } from '@/lib/modules/comments/application/purge-deleted-comments.use-case';

const DOCS = { RegulaminContent, PolitykaContent, TermsContentEn, PrivacyContentEn };
const POLICIES = { PolitykaContent, PrivacyContentEn };

function html(Doc: () => React.ReactElement) {
  return renderToStaticMarkup(React.createElement(Doc));
}

function text(Doc: () => React.ReactElement) {
  return html(Doc).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, ' ').replace(/ ([:;,.])/g, '$1');
}

function count(markup: string, tag: string) {
  return (markup.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;
}

describe('legal documents consistency', () => {
  it('every document names the same operator, address and contact email', () => {
    expect(LEGAL_CONTACT_EMAIL).toBe('support@pawelperfect.com');
    for (const [name, Doc] of Object.entries(DOCS)) {
      const rendered = text(Doc);
      expect(rendered, name).toContain('Paweł Perfect');
      expect(rendered, name).toContain('Złota 75');
      expect(rendered, name).toContain(LEGAL_CONTACT_EMAIL);
      expect(rendered, name).not.toMatch(/Kutashi|LLC ID|EIN\b/);
    }
  });

  it('the privacy policy does not name retired providers', () => {
    for (const [name, Doc] of Object.entries(POLICIES)) {
      expect(text(Doc), name).not.toMatch(/\b(Clerk|Vercel|Neon|Mux|Upstash|Workspace|YouTube|Vimeo|jsDelivr|DiceBear)\b/i);
    }
  });

  it('the privacy policy names every provider the code actually sends personal data to', () => {
    for (const [name, Doc] of Object.entries(POLICIES)) {
      const rendered = text(Doc);
      for (const provider of ['Hetzner', 'Cloudflare', 'Stripe', 'Resend', 'Google', 'Gmail', 'Turnstile']) {
        expect(rendered, `${name}: ${provider}`).toContain(provider);
      }
    }
  });

  it('the privacy policy lists the cookies the app sets under their real names', () => {
    for (const [name, Doc] of Object.entries(POLICIES)) {
      const rendered = text(Doc);
      for (const cookie of [`${SESSION_COOKIE_PREFIX}.*`, 'app-language', '__stripe_mid', '__stripe_sid', 'g_state']) {
        expect(rendered, `${name}: ${cookie}`).toContain(cookie);
      }
    }
  });

  it('retention periods stated in the policy match what the code enforces', () => {
    expect(SESSION_EXPIRES_IN_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(UNVERIFIED_ACCOUNT_RETENTION_DAYS).toBe(7);
    expect(AUTHOR_DELETED_COMMENT_RETENTION_DAYS).toBe(30);

    const pl = text(PolitykaContent);
    expect(pl).toContain(`niepotwierdzonym e-mailem usuwamy po ${UNVERIFIED_ACCOUNT_RETENTION_DAYS} dniach`);
    expect(pl).toContain(`usuniętego komentarza po ${AUTHOR_DELETED_COMMENT_RETENTION_DAYS} dniach`);
    expect(pl).toContain('sesja logowania wygasa po 30 dniach');
    expect(pl).toContain('pp.*: logowanie, do 30 dni');

    const en = text(PrivacyContentEn);
    expect(en).toContain(`unconfirmed email after ${UNVERIFIED_ACCOUNT_RETENTION_DAYS} days`);
    expect(en).toContain(`deleted comment after ${AUTHOR_DELETED_COMMENT_RETENTION_DAYS} days`);
    expect(en).toContain('sign-in session expires after 30 days');
    expect(en).toContain('pp.*: sign-in, up to 30 days');
  });

  it('the privacy policy describes passkey data (public key only, private key stays on the device)', () => {
    expect(text(PolitykaContent)).toContain('klucze dostępu (klucz publiczny, identyfikator i nazwa urządzenia; klucz prywatny zostaje na Twoim urządzeniu)');
    expect(text(PrivacyContentEn)).toContain('passkeys (public key, identifier and device name; the private key stays on your device)');
  });

  it('the Polish and English versions have the same structure', () => {
    for (const [pl, en] of [
      [RegulaminContent, TermsContentEn],
      [PolitykaContent, PrivacyContentEn],
    ] as const) {
      const a = html(pl);
      const b = html(en);
      for (const tag of ['section', 'li', 'p', 'code', 'a']) {
        expect(count(b, tag), `${en.name} <${tag}>`).toBe(count(a, tag));
      }
    }
  });

  it('the privacy policy does not describe support as buying access or mention complaints handling', () => {
    for (const [name, Doc] of Object.entries(POLICIES)) {
      expect(text(Doc), name).not.toMatch(/obsługa dostępu|handling access|reklamacj|complaint handling/i);
    }
  });
});
