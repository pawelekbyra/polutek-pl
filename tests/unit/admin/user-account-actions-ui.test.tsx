/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ push: vi.fn(), toast: vi.fn(), signOut: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => h.toast }));
vi.mock('@/lib/auth/sign-out', () => ({ signOutCompletely: h.signOut }));

import { UserDangerZone } from '@/app/admin/users/UserDangerZone';
import { UserRoleActions } from '@/app/admin/users/UserRoleActions';

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function openDeleteDialog() {
  render(<UserDangerZone userId="user-1" email="Jan@Example.com" role="USER" isDeleted={false} isSelf={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Usuń użytkownika' }));
  return screen.getByRole('button', { name: 'Usuń użytkownika na zawsze' });
}

describe('UserDangerZone', () => {
  it('lists the consequences and unlocks the delete button only after the e-mail is typed (case-insensitive)', () => {
    const confirm = openDeleteDialog();

    expect(screen.getByText(/Dane logowania zostaną usunięte/)).toBeInTheDocument();
    expect(screen.getByText(/Wpłaty i komentarze zostają, jako anonimowe/)).toBeInTheDocument();
    expect(screen.getByText(/Operacji nie da się cofnąć/)).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    const input = screen.getByLabelText(/Wpisz adres e-mail użytkownika/);
    fireEvent.change(input, { target: { value: 'jan@example' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: ' jan@example.com ' } });
    expect(confirm).toBeEnabled();
  });

  it('sends the typed e-mail and returns to the list with a notice after success', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(200, { success: true }));
    const confirm = openDeleteDialog();
    fireEvent.change(screen.getByLabelText(/Wpisz adres e-mail użytkownika/), { target: { value: 'jan@example.com' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/users?deleted=1'));
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/users/user-1', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ confirmEmail: 'jan@example.com' }),
    }));
    expect(h.toast).toHaveBeenCalledWith('Użytkownik został usunięty.', 'success');
  });

  it('shows the reason (not the code) and offers sign-out when a fresh sign-in is required', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(403, { error: 'REAUTH_REQUIRED', message: 'x' }));
    const confirm = openDeleteDialog();
    fireEvent.change(screen.getByLabelText(/Wpisz adres e-mail użytkownika/), { target: { value: 'jan@example.com' } });
    fireEvent.click(confirm);

    expect(await screen.findByText(/wymaga świeżego logowania/)).toBeInTheDocument();
    expect(screen.queryByText('REAUTH_REQUIRED')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wyloguj i zaloguj ponownie' })).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('shows a readable reason for a server refusal', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(409, { error: 'TARGET_IS_ADMIN', message: '...' }));
    const confirm = openDeleteDialog();
    fireEvent.change(screen.getByLabelText(/Wpisz adres e-mail użytkownika/), { target: { value: 'jan@example.com' } });
    fireEvent.click(confirm);

    expect(await screen.findByText(/Najpierw odbierz mu rolę ADMIN/)).toBeInTheDocument();
  });

  it.each([
    [{ isSelf: true, isDeleted: false, role: 'USER' }, /własnego konta/],
    [{ isSelf: false, isDeleted: false, role: 'ADMIN' }, /Najpierw odbierz mu rolę ADMIN/],
    [{ isSelf: false, isDeleted: true, role: 'USER' }, /już usunięte/],
  ])('disables deletion with an explanation (%o)', (props, reason) => {
    render(<UserDangerZone userId="u" email="a@b.c" {...props} />);
    expect(screen.getByRole('button', { name: 'Usuń użytkownika' })).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
  });
});

describe('UserRoleActions', () => {
  it('confirms the effects before granting ADMIN and refreshes the page after success', async () => {
    const onDone = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(200, { changed: true, role: 'ADMIN' }));
    render(<UserRoleActions userId="user-1" role="USER" emailVerified isDeleted={false} isSelf={false} onActionComplete={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Nadaj rolę ADMIN' }));
    expect(screen.getByText(/pełny dostęp do panelu admina/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole('button', { name: 'Nadaj rolę ADMIN' });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/users/user-1/role', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ role: 'ADMIN' }),
    }));
  });

  it('shows the reason when the last admin cannot be demoted', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(409, { error: 'LAST_ADMIN' }));
    render(<UserRoleActions userId="user-1" role="ADMIN" emailVerified isDeleted={false} isSelf={false} onActionComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Odbierz rolę ADMIN' }));
    const buttons = screen.getAllByRole('button', { name: 'Odbierz rolę ADMIN' });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText(/To ostatni administrator/)).toBeInTheDocument();
  });

  it('does not offer ADMIN to an unverified account or a change of your own role', () => {
    render(<UserRoleActions userId="u" role="USER" emailVerified={false} isDeleted={false} isSelf={false} onActionComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Nadaj rolę ADMIN' })).toBeDisabled();
    cleanup();
    render(<UserRoleActions userId="u" role="ADMIN" emailVerified isDeleted={false} isSelf onActionComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Odbierz rolę ADMIN' })).toBeDisabled();
    expect(screen.getByText('Nie możesz zmienić własnej roli.')).toBeInTheDocument();
  });
});
