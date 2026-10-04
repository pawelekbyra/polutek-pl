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

  it('shows an empty own-templates section with a CTA when the admin has none', async () => {
    const onNew = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);

    render(<TemplatesList onEdit={vi.fn()} onNew={onNew} />);

    expect(await screen.findByText('Nie masz jeszcze własnych szablonów.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /nowy szablon/i }));

    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('marks system mails as default or changed and offers restoring a changed one', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'default-verify-email', slug: 'verify-email', name: 'Potwierdzenie e-maila', description: null, isSystem: true, isCustomized: false, subject: 'S', updatedAt: null },
        { id: 't1', slug: 'welcome-email', name: 'Powitanie', description: null, isSystem: true, isCustomized: true, subject: 'W', updatedAt: '2026-10-03T10:00:00.000Z' },
      ],
    } as Response);

    render(<TemplatesList onEdit={vi.fn()} onNew={vi.fn()} />);

    expect(await screen.findByText('Domyślny')).toBeInTheDocument();
    expect(screen.getByText('Zmieniony')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Przywróć domyślny' })).toHaveLength(1);
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
