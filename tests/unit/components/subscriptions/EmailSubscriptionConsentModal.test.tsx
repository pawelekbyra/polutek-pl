/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EmailSubscriptionConsentModal from '@/app/components/subscriptions/EmailSubscriptionConsentModal';
import React from 'react';
import { txFor } from "../../i18n/mock-language";

const lang = vi.hoisted(() => ({ language: 'pl' }));

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
      expect(screen.getByTestId('email-consent-legal').textContent).toContain(withdraw);
      for (const [name, href] of [[privacy, privacyHref], [terms, termsHref]]) {
        const link = screen.getByRole('link', { name });
        expect(link.getAttribute('href')).toBe(href);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
      }
      cleanup();
    }
  });
});
