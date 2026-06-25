/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesList } from '@/app/admin/emails/TemplatesList';

const originalFetch = global.fetch;

describe('TemplatesList', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('renders an empty state with a CTA when there are no templates', async () => {
    const onNew = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);

    render(<TemplatesList onEdit={vi.fn()} onNew={onNew} />);

    expect(await screen.findByText('Brak szablonów email')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dodaj szablon/i }));

    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('renders an error state when the templates API fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'boom' }) } as Response);

    render(<TemplatesList onEdit={vi.fn()} onNew={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Nie można załadować szablonów');
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się pobrać szablonów email.');
  });

  it('renders an error state when the templates API returns invalid data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ templates: [] }) } as Response);

    render(<TemplatesList onEdit={vi.fn()} onNew={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('API zwróciło nieprawidłową listę szablonów.');
  });
});
