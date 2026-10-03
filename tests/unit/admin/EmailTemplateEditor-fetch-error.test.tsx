/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { EmailTemplateEditor } from '@/app/admin/emails/EmailTemplateEditor';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EmailTemplateEditor surfaces a load failure instead of hanging or going silently blank', () => {
  it('shows an error instead of staying stuck on the loading skeleton when the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not found' }),
    } as Response);

    render(<EmailTemplateEditor templateSlug="missing-template" onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Nie udało się wczytać szablonu/)).toBeInTheDocument();
    });
  });

  it('offers exactly the variables the server defines and restores a changed system mail to its default', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          slug: 'verify-email', name: 'Potwierdzenie e-maila', description: 'Link', isSystem: true, isCustomized: true,
          subject: 'S', html: '<a href="{{actionUrl}}">x</a>', subjectEn: null, htmlEn: null,
          variables: [{ key: 'actionUrl', label: 'Link akcji', sample: { pl: 'https://x/pl', en: 'https://x/en' } }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, restoredDefault: true }) })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ slug: 'verify-email', isSystem: true, isCustomized: false, subject: 'Default', html: 'd', variables: [] }),
      });
    global.fetch = fetchMock as any;

    render(<EmailTemplateEditor templateSlug="verify-email" onBack={() => {}} />);

    await waitFor(() => expect(screen.getByText('{{actionUrl}}')).toBeInTheDocument());
    expect(screen.queryByText('{{unsubscribeLink}}')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Przywróć domyślny' }).click();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/templates?slug=verify-email', { method: 'DELETE' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Przywróć domyślny' })).not.toBeInTheDocument());
  });

  it('shows an error instead of hanging forever when the fetch itself rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    render(<EmailTemplateEditor templateSlug="some-template" onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Nie udało się wczytać szablonu/)).toBeInTheDocument();
    });
  });
});
