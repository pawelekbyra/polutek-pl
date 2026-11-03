/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import UserMenu from '@/app/components/auth/UserMenu';
import { txFor } from '../i18n/mock-language';

let language: 'pl' | 'en' = 'pl';
vi.mock('@/lib/auth/react', () => ({ useUser: () => ({ user: { id: 'u1', fullName: 'Viewer', primaryEmailAddress: { emailAddress: 'v@example.com' } } }), useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language, tx: txFor(language) }) }));
vi.mock('@/app/components/useSwitchLanguage', () => ({ useSwitchLanguage: () => vi.fn() }));
vi.mock('@/app/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));
vi.mock('@/app/components/auth/AccountModal', () => ({ default: () => null }));
vi.mock('@/app/components/premium-pass/PatronCheckoutHost', () => ({ OPEN_PATRON_EVENT: 'polutek:open-patron', PatronCheckoutHost: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); language = 'pl'; });

function openPanel(role?: 'AUTHOR' | 'VIP' | 'BASE') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  render(<UserMenu isAdmin={false} role={role} />);
  fireEvent.click(screen.getByRole('button', { name: /Menu konta|Account menu/ }));
  return screen.getByRole('dialog');
}

describe('account panel role', () => {
  it('Premium: only the short "VIP · Premium" pill, no purchase bar', () => {
    const panel = openPanel('VIP');
    expect(within(panel).getByText('VIP · Premium')).toBeTruthy();
    expect(within(panel).queryByRole('region', { name: 'Premium' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Kup Premium' })).toBeNull();
    expect(within(panel).queryByText(/Nie masz jeszcze Premium/)).toBeNull();
  });

  it('Base: grey "Normik" pill and the blue purchase bar with a named button that opens the checkout and closes the panel', () => {
    vi.useFakeTimers();
    const panel = openPanel('BASE');
    expect(within(panel).getByText('Normik')).toBeTruthy();
    const bar = within(panel).getByRole('region', { name: 'Premium' });
    expect(within(bar).getByText('Nie masz jeszcze Premium.')).toBeTruthy();
    const opened = vi.fn();
    window.addEventListener('polutek:open-patron', opened);
    fireEvent.click(within(bar).getByRole('button', { name: 'Kup Premium' }));
    expect(opened).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole('dialog')).toBeNull();
    window.removeEventListener('polutek:open-patron', opened);
    vi.useRealTimers();
  });

  it('Creator: blue "Twórca" pill, no purchase bar', () => {
    const panel = openPanel('AUTHOR');
    expect(within(panel).getByText('Twórca')).toBeTruthy();
    expect(within(panel).queryByRole('region', { name: 'Premium' })).toBeNull();
  });

  it('English texts for Base', () => {
    language = 'en';
    const panel = openPanel('BASE');
    expect(within(panel).getByText('Base')).toBeTruthy();
    expect(within(panel).getByText("You don't have Premium yet.")).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Get Premium' })).toBeTruthy();
  });

  it('shows no role pill and no bar while the role is unknown', () => {
    const panel = openPanel();
    expect(panel.querySelector('[data-role-pill]')).toBeNull();
    expect(within(panel).queryByRole('region', { name: 'Premium' })).toBeNull();
  });
});
