/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EmailSubscriptionConsentModal from '@/app/components/subscriptions/EmailSubscriptionConsentModal';
import React from 'react';
import { readFileSync } from 'node:fs';
import { txFor } from "../../i18n/mock-language";
import type { Locale } from '@/lib/i18n/routing';

const lang = vi.hoisted(() => ({ language: 'pl' as Locale }));

// Mock LanguageContext
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: lang.language, tx: txFor(lang.language),
    t: {
      confirmSubscribeTitle: 'CZY CHCESZ SUBSKRYBOWAĆ?',
      confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
      yes: 'TAK',
      no: 'NIE',
    }
  })
}));

describe('EmailSubscriptionConsentModal', () => {
  afterEach(() => {
    cleanup();
    lang.language = 'pl';
  });

  it('renders correctly when open', () => {
    render(
      <EmailSubscriptionConsentModal
        open={true}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByText('CZY CHCESZ SUBSKRYBOWAĆ?')).not.toBeNull();
    expect(screen.getByText('Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.')).not.toBeNull();
    expect(screen.getByText('TAK')).not.toBeNull();
    expect(screen.getByText('NIE')).not.toBeNull();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <EmailSubscriptionConsentModal
        open={false}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onConfirm when TAK is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <EmailSubscriptionConsentModal
        open={true}
        onConfirm={onConfirm}
        onDismiss={() => {}}
      />
    );

    fireEvent.click(screen.getByText('TAK'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onDismiss when NIE is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <EmailSubscriptionConsentModal
        open={true}
        onConfirm={() => {}}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByText('NIE'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows error message when provided', () => {
    render(
      <EmailSubscriptionConsentModal
        open={true}
        errorMessage="Something went wrong"
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByText('Something went wrong')).not.toBeNull();
  });

  it('disables buttons when pending', () => {
    render(
      <EmailSubscriptionConsentModal
        open={true}
        pending={true}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'TAK' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'NIE' })).toHaveProperty('disabled', true);
  });

  it("links the Privacy Policy and the Terms in the reader's language, in a new tab, and says how to withdraw", () => {
    for (const [language, privacy, terms, privacyHref, termsHref, withdraw] of [
      ['pl', 'Polityka prywatności', 'Regulamin', '/polityka-prywatnosci', '/regulamin', 'Zgodę wycofasz w każdej chwili'],
      ['en', 'Privacy Policy', 'Terms', '/en/privacy-policy', '/en/terms', 'withdraw consent at any time'],
    ] as const) {
      lang.language = language;
      render(<EmailSubscriptionConsentModal open onConfirm={() => {}} onDismiss={() => {}} />);
      expect(screen.getByTestId('email-consent-legal').textContent!.replace(/ /g, ' ')).toContain(withdraw);
      for (const [name, href] of [[privacy, privacyHref], [terms, termsHref]]) {
        const link = screen.getByRole('link', { name });
        expect(link.getAttribute('href')).toBe(href);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
      }
      cleanup();
    }
  });

  it("protects line breaking in CSS, in any language: balanced text, width cap, lang for hyphenation, CJK rules", () => {
    for (const language of ['pl', 'de', 'zh'] as const) {
      lang.language = language;
      render(<EmailSubscriptionConsentModal open onConfirm={() => {}} onDismiss={() => {}} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('lang')).toBe(language === 'zh' ? 'zh-CN' : language);
      expect(dialog.className).toContain('min(400px,calc(100vw-2rem))');
      expect(dialog.className).not.toContain('340px');
      expect(dialog.className).toContain('[line-break:strict]');
      const description = dialog.querySelector('[data-slot="dialog-description"]') as HTMLElement;
      expect(description.className).toContain('text-balance');
      expect(description.className).toContain('hyphens-auto');
      expect(dialog.querySelector('[data-slot="dialog-title"]')!.className).toContain('text-balance');
      expect(screen.getByTestId('email-consent-legal').className).toContain('text-balance');
      cleanup();
    }
  });

  it("keeps short Polish words with the next word via no-break spaces, not hand-made breaks in the dictionary", () => {
    render(<EmailSubscriptionConsentModal open onConfirm={() => {}} onDismiss={() => {}} />);
    const text = screen.getByRole('dialog').querySelector('[data-slot="dialog-description"]')!.textContent!;
    expect(text).toContain('na otrzymywanie');
    const dictionary = readFileSync('lib/i18n/dictionary.ts', 'utf8');
    expect(dictionary).not.toMatch(/confirmSubscribeText:[^\n]*(&nbsp;|\u00a0|<br)/);
  });
});
