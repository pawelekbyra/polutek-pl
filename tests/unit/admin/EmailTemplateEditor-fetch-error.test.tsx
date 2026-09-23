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

  it('shows an error instead of hanging forever when the fetch itself rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    render(<EmailTemplateEditor templateSlug="some-template" onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Nie udało się wczytać szablonu/)).toBeInTheDocument();
    });
  });
});
