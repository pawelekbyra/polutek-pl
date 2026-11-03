/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import UserMenu from '@/app/components/auth/UserMenu';
import { txFor } from '../i18n/mock-language';

let language: 'pl' | 'en' = 'pl';
vi.mock('@/lib/auth/react', () => ({ useUser: () => ({ user: { id: 'u1', fullName: 'Viewer' } }), useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language, tx: txFor(language) }) }));
vi.mock('@/app/components/useSwitchLanguage', () => ({ useSwitchLanguage: () => vi.fn() }));
vi.mock('@/app/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));
vi.mock('@/app/components/auth/AccountModal', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); language = 'pl'; });

const trigger = () => screen.getByRole('button', { name: /Menu konta|Account menu/ });
const ring = () => trigger().firstElementChild as HTMLElement;

describe('top bar avatar role ring', () => {
  it.each([
    ['AUTHOR', 'Menu konta: Twórca', 'ring-[var(--chan-blue)]'],
    ['VIP', 'Menu konta: Użytkownik VIP', 'ring-[var(--chan-amber-bright)]'],
    ['BASE', 'Menu konta: Normik', 'ring-[var(--chan-muted)]'],
  ] as const)('%s: ring colour from the shared token and the role in the accessible name', (role, name, token) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    render(<UserMenu isAdmin={false} role={role} />);
    expect(trigger().getAttribute('aria-label')).toBe(name);
    expect(trigger().getAttribute('data-role')).toBe(role);
    expect(ring().className).toContain(token);
    expect(ring().className).toContain('ring-2 ring-offset-2');
  });

  it('names the role in English too', () => {
    language = 'en';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    render(<UserMenu isAdmin={false} role="BASE" />);
    expect(trigger().getAttribute('aria-label')).toBe('Account menu: Base');
  });

  it('shows no ring and keeps the plain name while the role is not known', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    render(<UserMenu isAdmin={false} />);
    expect(trigger().getAttribute('aria-label')).toBe('Menu konta');
    expect(trigger().hasAttribute('data-role')).toBe(false);
    expect(ring().className).not.toContain('ring-2');
  });
});
