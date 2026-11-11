/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import React from 'react';
import { ReportDialog } from '@/app/components/comments/components/ReportDialog';
import { DeleteCommentDialog } from '@/app/components/comments/components/DeleteCommentDialog';
import { txFor } from '../../i18n/mock-language';

vi.mock('@/lib/i18n/language-context', () => ({ useOptionalTx: () => txFor('pl') }));

afterEach(cleanup);

describe('report dialog', () => {
  it('uses roving radio focus and arrow/Home/End navigation to choose a reason', () => {
    render(<ReportDialog isOpen onClose={vi.fn()} onSubmit={vi.fn()} language="pl" />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(6);
    expect(radios.filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([radios[1]]);

    fireEvent.keyDown(radios[1], { key: 'ArrowRight' });
    expect(radios[2]).toHaveFocus();
    fireEvent.keyDown(radios[2], { key: 'ArrowUp' });
    expect(radios[1]).toHaveFocus();
    fireEvent.keyDown(radios[1], { key: 'Home' });
    expect(radios[0]).toHaveFocus();
    fireEvent.keyDown(radios[0], { key: 'End' });
    expect(radios[5]).toHaveFocus();
    expect(radios[5]).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(radios[5], { key: 'ArrowDown' });
    expect(radios[0]).toHaveFocus();
  });

  it('lists every reason at once and sends the chosen one', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReportDialog isOpen onClose={vi.fn()} onSubmit={onSubmit} language="pl" />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'Spam', 'Nękanie', 'Mowa nienawiści', 'Treści nieodpowiednie', 'Spoiler', 'Inne',
    ]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Nękanie' }));
    expect(screen.getByRole('radio', { name: 'Nękanie' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Zgłoś' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('HARASSMENT', undefined));
  });

  it('announces pending submission and keeps the dialog open until it settles', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve; }));
    const onClose = vi.fn();
    render(<ReportDialog isOpen onClose={onClose} onSubmit={onSubmit} language="pl" />);

    fireEvent.click(screen.getByRole('button', { name: 'Zgłoś' }));
    const dialog = screen.getByRole('dialog', { name: 'Zgłoś komentarz' });
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Operacja w toku.');
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled();
    await waitFor(() => expect(dialog).toHaveFocus());

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => { resolveSubmit?.(); });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('delete comment dialog', () => {
  it('asks in our own dialog and only deletes after the confirm button', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<DeleteCommentDialog isOpen onClose={onClose} onConfirm={onConfirm} language="pl" />);
    const dialog = screen.getByRole('dialog', { name: 'Usunąć komentarz?' });
    expect(dialog).toHaveAccessibleDescription('Komentarz zniknie z rozmowy.');
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });
});
