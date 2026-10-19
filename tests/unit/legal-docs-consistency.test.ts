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
import { TECHNICAL_DATA_RETENTION_DAYS } from '@/lib/modules/privacy/domain/retention';
import { TELEMETRY_AGGREGATE_RETENTION_MONTHS, TELEMETRY_RAW_RETENTION_DAYS } from '@/lib/telemetry/retention';

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
      if (name === 'RegulaminContent') continue; // platform terms are issued by POLUTEK MEDIA sp. z o.o.
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
      for (const provider of ['Hetzner', 'Cloudflare', 'Stripe', 'Amazon Web Services', 'Resend', 'Google', 'Gmail', 'Turnstile']) {
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

  it('the IP / browser-data period in the policy is the one the retention cron enforces', () => {
    expect(TECHNICAL_DATA_RETENTION_DAYS).toBe(90);
    expect(text(PolitykaContent)).toContain(
      `Adres IP i dane przeglądarki zapisane w naszej bazie usuwamy po ${TECHNICAL_DATA_RETENTION_DAYS} dniach`,
    );
    expect(text(PrivacyContentEn)).toContain(
      `We erase IP addresses and browser data stored in our database after ${TECHNICAL_DATA_RETENTION_DAYS} days`,
    );
    // Expired sessions and e-mail links are deleted daily (prune-expired-auth), account deletion erases comment text.
    expect(text(PolitykaContent)).toContain('wygasłe sesje i linki z e-maili kasujemy codziennie');
    expect(text(PrivacyContentEn)).toContain('expired sessions and email links are erased daily');
    expect(text(PolitykaContent)).toContain('treść Twoich komentarzy');
    expect(text(PrivacyContentEn)).toContain('the text of your comments');
  });

  it('the statistics described in the policy match the telemetry code: periods, no cookies, opt-out signals', () => {
    expect(TELEMETRY_RAW_RETENTION_DAYS).toBe(90);
    expect(TELEMETRY_AGGREGATE_RETENTION_MONTHS).toBe(25);
    const pl = text(PolitykaContent);
    expect(pl).toContain(`zdarzenia statystyczne po ${TELEMETRY_RAW_RETENTION_DAYS} dniach`);
    expect(pl).toContain(`dzienne zestawienia statystyk po ${TELEMETRY_AGGREGATE_RETENTION_MONTHS} miesiącach`);
    expect(pl).toContain('Global Privacy Control lub Do Not Track');
    expect(pl).toContain('Statystyki z § 2 działają bez cookies i bez pamięci przeglądarki');
    const en = text(PrivacyContentEn);
    expect(en).toContain(`statistics events after ${TELEMETRY_RAW_RETENTION_DAYS} days`);
    expect(en).toContain(`daily statistics summaries after ${TELEMETRY_AGGREGATE_RETENTION_MONTHS} months`);
    expect(en).toContain('Global Privacy Control or Do Not Track');
    expect(en).toContain('without cookies and without browser storage');
  });

  it('the policy says Google sign-in (g_state) starts only after the sign-in window is opened', () => {
    expect(text(PolitykaContent)).toContain('g_state: logowanie przez Google, po otwarciu okna logowania');
    expect(text(PrivacyContentEn)).toContain('g_state: Google sign-in, after you open the sign-in window');
  });

  it('the Polish and English versions have the same structure', () => {
    for (const [pl, en] of [
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
