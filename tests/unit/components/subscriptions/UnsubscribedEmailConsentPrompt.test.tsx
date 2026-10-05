/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import UnsubscribedEmailConsentPrompt from '@/app/components/subscriptions/UnsubscribedEmailConsentPrompt';
import React from 'react';
import { txFor } from "../../i18n/mock-language";

// Mock LanguageContext
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ tx: txFor('pl'),
    t: {
      confirmSubscribeTitle: 'CZY CHCESZ SUBSKRYBOWAĆ?',
      confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
      yes: 'TAK',
      no: 'NIE',
    }
  })
}));

// Mock EmailSubscriptionConsentModal to avoid useLanguage hook issue in deep render
vi.mock('@/app/components/subscriptions/EmailSubscriptionConsentModal', () => ({
  default: ({ open, onConfirm, onDismiss, errorMessage, pending }: any) => {
    if (!open) return null;
    return (
      <div>
        <h1>CZY CHCESZ SUBSKRYBOWAĆ?</h1>
        <p>Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.</p>
        {errorMessage && <div>{errorMessage}</div>}
        <button onClick={onConfirm} disabled={pending}>TAK</button>
        <button onClick={onDismiss} disabled={pending}>NIE</button>
      </div>
    );
  }
}));

// Mock Clerk useAuth / useUser
const mockUseAuth = vi.fn();
const mockUseUser = vi.fn();
vi.mock('@/lib/auth/react', () => ({
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

// This prompt is now gated to only auto-open within a short window after
// account creation (i.e. "first login after registration"), so tests that
// expect it to open must simulate a freshly-created Clerk user.
const FRESHLY_REGISTERED_USER = { createdAt: new Date() };

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('UnsubscribedEmailConsentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
    mockUseUser.mockReturnValue({ user: FRESHLY_REGISTERED_USER });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not open while the nickname dialog (onboarding) is pending, and opens right after it', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_1' });
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ isSubscribed: false }) });
    mockUseUser.mockReturnValue({ user: { createdAt: new Date(), onboardingPending: true } });

    const { rerender } = render(<UnsubscribedEmailConsentPrompt />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('CZY CHCESZ SUBSKRYBOWAĆ?')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    // Nickname chosen: onboarding done. Even if it took longer than the "fresh registration"
    // window, the prompt must still appear, because onboarding was seen in this session.
    mockUseUser.mockReturnValue({ user: { createdAt: new Date(Date.now() - 60 * 60 * 1000), onboardingPending: false } });
    rerender(<UnsubscribedEmailConsentPrompt />);
    await waitFor(() => expect(screen.getByText('CZY CHCESZ SUBSKRYBOWAĆ?')).toBeTruthy());
  });

  it('renders nothing for guests', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: null });
    const { container } = render(<UnsubscribedEmailConsentPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing if already subscribed', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ isSubscribed: true }),
    });

    const { container } = render(<UnsubscribedEmailConsentPrompt />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing for a returning user (not a fresh registration)', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    mockUseUser.mockReturnValue({ user: { createdAt: new Date('2020-01-01T00:00:00Z') } });

    const { container } = render(<UnsubscribedEmailConsentPrompt />);

    expect(container.firstChild).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders nothing if already dismissed in localStorage', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    localStorage.setItem('polutek:email-consent-prompt-dismissed:user_123', 'true');

    const { container } = render(<UnsubscribedEmailConsentPrompt />);

    expect(container.firstChild).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders modal if authenticated, not subscribed, and not dismissed', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ isSubscribed: false }),
    });

    render(<UnsubscribedEmailConsentPrompt />);

    await waitFor(() => {
      expect(screen.getByText('CZY CHCESZ SUBSKRYBOWAĆ?')).not.toBeNull();
    });
  });

  it('calls POST /api/subscriptions on confirm', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSubscribed: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSubscribed: true }),
      });

    render(<UnsubscribedEmailConsentPrompt />);

    const confirmBtn = await screen.findByText('TAK');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/subscriptions', expect.objectContaining({
        method: 'POST',
      }));
    });

    await waitFor(() => {
      expect(screen.queryByText('CZY CHCESZ SUBSKRYBOWAĆ?')).toBeNull();
    });
  });

  it('sets dismissal in localStorage on NIE click', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ isSubscribed: false }),
    });

    render(<UnsubscribedEmailConsentPrompt />);

    const dismissBtn = await screen.findByText('NIE');
    fireEvent.click(dismissBtn);

    expect(localStorage.getItem('polutek:email-consent-prompt-dismissed:user_123')).toBe('true');
    expect(screen.queryByText('CZY CHCESZ SUBSKRYBOWAĆ?')).toBeNull();
  });

  it('shows error message if POST /api/subscriptions fails', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, userId: 'user_123' });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSubscribed: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'TRUSTED_EMAIL_REQUIRED' }),
      });

    render(<UnsubscribedEmailConsentPrompt />);

    const confirmBtn = await screen.findByText('TAK');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Konto musi mieć zweryfikowany adres e-mail.')).not.toBeNull();
    });

    expect(screen.getByText('CZY CHCESZ SUBSKRYBOWAĆ?')).not.toBeNull();
  });
});
