/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import UserMenu from '@/app/components/auth/UserMenu';
import { txFor } from '../i18n/mock-language';
vi.mock('@/lib/auth/react', () => ({ useUser: () => ({ user: { id: 'u1', fullName: 'Viewer' } }), useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));
vi.mock('@/app/components/useSwitchLanguage', () => ({ useSwitchLanguage: () => vi.fn() }));
vi.mock('@/app/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));
vi.mock('@/app/components/auth/AccountModal', () => ({ default: ({ open, initialSection }: { open: boolean; initialSection: string }) => open ? <div data-testid="account-section">{initialSection}</div> : null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('notification settings entry', () => {
  it('opens the real account settings section from the notification panel event', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    render(<UserMenu isAdmin={false} />);
    act(() => window.dispatchEvent(new CustomEvent('polutek:open-notification-settings')));
    expect(screen.getByTestId('account-section').textContent).toBe('notifications');
  });
  it('normal account entry still opens the profile and closes the account menu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }))));
    render(<UserMenu isAdmin={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu konta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Moje konto' }));
    expect(screen.getByTestId('account-section').textContent).toBe('profile');
    expect(screen.queryByRole('dialog', { name: 'Menu konta' })).toBeNull();
  });
});
