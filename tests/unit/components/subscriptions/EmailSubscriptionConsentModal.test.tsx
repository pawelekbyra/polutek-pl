import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailSubscriptionConsentModal from '@/app/components/subscriptions/EmailSubscriptionConsentModal';
import React from 'react';

// Mock LanguageContext
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      confirmSubscribeTitle: 'CZY CHCESZ SUBSKRYBOWAĆ?',
      confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
      yes: 'TAK',
      no: 'NIE',
    }
  })
}));

describe('EmailSubscriptionConsentModal', () => {
  it('renders correctly when open', () => {
    render(
      <EmailSubscriptionConsentModal
        open={true}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByText('CZY CHCESZ SUBSKRYBOWAĆ?')).toBeInTheDocument();
    expect(screen.getByText('Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.')).toBeInTheDocument();
    expect(screen.getByText('TAK')).toBeInTheDocument();
    expect(screen.getByText('NIE')).toBeInTheDocument();
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

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'TAK' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'NIE' })).toBeDisabled();
  });
});
