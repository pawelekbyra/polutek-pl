/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import UserMenu from '@/app/components/auth/UserMenu';
import { txFor } from '../i18n/mock-language';

let language: 'pl' | 'en' = 'pl';
vi.mock('@/lib/auth/react', () => ({ useUser: () => ({ user: { id: 'u1', fullName: 'Viewer', primaryEmailAddress: { emailAddress: 'v@example.com' } } }), useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language, tx: txFor(language) }) }));
vi.mock('@/app/components/useSwitchLanguage', () => ({ useSwitchLanguage: () => vi.fn() }));
vi.mock('@/app/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));
vi.mock('@/app/components/auth/AccountModal', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); language = 'pl'; });

function openPanel(role?: 'AUTHOR' | 'VIP' | 'BASE') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  render(<UserMenu isAdmin={false} role={role} />);
  fireEvent.click(screen.getByRole('button', { name: /Menu konta|Account menu/ }));
  return screen.getByRole('dialog');
}

describe('account panel role', () => {
  it('Premium: only the short "VIP · Premium" pill', () => {
    const panel = openPanel('VIP');
    expect(within(panel).getByText('VIP · Premium')).toBeTruthy();
    expect(panel.querySelector('[data-role-pill="VIP"]')).not.toBeNull();
  });

  it('Base: grey "Normik" pill and no purchase bar', () => {
    const panel = openPanel('BASE');
    expect(within(panel).getByText('Normik')).toBeTruthy();
    expect(within(panel).queryByRole('region', { name: 'Premium' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: /Premium/ })).toBeNull();
    expect(within(panel).queryByText(/Nie masz jeszcze Premium/)).toBeNull();
  });

  it('Creator: blue "Twórca" pill', () => {
    const panel = openPanel('AUTHOR');
    expect(within(panel).getByText('Twórca')).toBeTruthy();
  });

  it('English name for Base', () => {
    language = 'en';
    const panel = openPanel('BASE');
    expect(within(panel).getByText('Base')).toBeTruthy();
  });

  it('shows no role pill while the role is unknown', () => {
    const panel = openPanel();
    expect(panel.querySelector('[data-role-pill]')).toBeNull();
  });
});
