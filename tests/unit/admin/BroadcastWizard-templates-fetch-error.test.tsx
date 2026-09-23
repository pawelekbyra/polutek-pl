/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { BroadcastWizard } from '@/app/admin/emails/components/BroadcastWizard';
import { ToastProvider } from '@/app/hooks/useToast';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderWizard() {
  return render(
    <ToastProvider>
      <BroadcastWizard onBack={() => {}} />
    </ToastProvider>,
  );
}

describe('BroadcastWizard survives a failed /api/admin/templates load', () => {
  it('does not crash and shows an error toast when the templates response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    } as Response);

    renderWizard();

    expect(screen.getByText('Krok 1: Treść wiadomości')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Nie udało się wczytać szablonów wiadomości.')).toBeInTheDocument();
    });

    // The wizard must still be usable — no crash from templates.map on a
    // non-array value.
    expect(screen.getByText('Krok 1: Treść wiadomości')).toBeInTheDocument();
  });

  it('does not crash and shows an error toast when the fetch itself rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Nie udało się wczytać szablonów wiadomości.')).toBeInTheDocument();
    });

    expect(screen.getByText('Krok 1: Treść wiadomości')).toBeInTheDocument();
  });
});
