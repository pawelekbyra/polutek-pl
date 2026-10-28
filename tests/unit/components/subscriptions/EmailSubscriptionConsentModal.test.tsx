/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import EmailSubscriptionConsentModal from '@/app/components/subscriptions/EmailSubscriptionConsentModal';
import React from 'react';
import { txFor } from "../../i18n/mock-language";

const lang = vi.hoisted(() => ({ language: 'pl' }));

// Mock LanguageContext
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: lang.language, tx: txFor(lang.language),
    t: {
      subscribe: 'SUBSKRYBUJ',
      confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
    }
  })
}));

const SUBSCRIBE = { name: 'SUBSKRYBUJ' };
const NOT_NOW = { name: 'Nie teraz' };

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

    expect(screen.getByText('Chcesz subskrybować?')).not.toBeNull();
    expect(screen.getByText('Dostaniesz powiadomienie o nowych filmach i premierach.')).not.toBeNull();
    expect(screen.getByText(/Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach\./)).not.toBeNull();
    expect(screen.getByRole('button', SUBSCRIBE)).not.toBeNull();
    expect(screen.getByRole('button', NOT_NOW)).not.toBeNull();
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

  it('calls onConfirm when Subscribe is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <EmailSubscriptionConsentModal
        open={true}
        onConfirm={onConfirm}
        onDismiss={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', SUBSCRIBE));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onDismiss when Not now is clicked, and when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <EmailSubscriptionConsentModal
        open={true}
        onConfirm={() => {}}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', NOT_NOW));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
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

    expect(screen.getByRole('alert').textContent).toBe('Something went wrong');
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

    expect(screen.getByRole('button', SUBSCRIBE)).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', NOT_NOW)).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Zamknij' })).toHaveProperty('disabled', true);
  });

  it('while pending, marks the primary button busy and Escape does not dismiss', () => {
    const onDismiss = vi.fn();
    render(<EmailSubscriptionConsentModal open pending onConfirm={() => {}} onDismiss={onDismiss} />);
    expect(screen.getByRole('button', SUBSCRIBE).getAttribute('aria-busy')).toBe('true');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('names the channel in the title, and falls back to a generic title without one', () => {
    const { rerender } = render(
      <EmailSubscriptionConsentModal open channelName="  Paweł Perfect " onConfirm={() => {}} onDismiss={() => {}} />
    );
    expect(screen.getByRole('dialog').textContent).toContain('Subskrybować Paweł Perfect?');
    rerender(<EmailSubscriptionConsentModal open channelName="   " onConfirm={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('dialog').textContent).toContain('Chcesz subskrybować?');
  });

  it('is a labelled, described dialog, moves focus into itself and closes on Escape', async () => {
    const onDismiss = vi.fn();
    render(<EmailSubscriptionConsentModal open channelName="Kanał" onConfirm={() => {}} onDismiss={onDismiss} />);
    const dialog = screen.getByRole('dialog');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Subskrybować Kanał?');
    expect(document.getElementById(dialog.getAttribute('aria-describedby') ?? '')?.textContent).toContain('Dostaniesz powiadomienie');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
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
