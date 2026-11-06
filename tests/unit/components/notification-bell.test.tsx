/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationBell from '@/app/components/notifications/NotificationBell';
import { txFor } from '../i18n/mock-language';
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/lib/auth/react', () => ({ useAuth: () => ({ userId: 'u1' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));

const item = (id: string, type: string, href: string | null = '/watch/first#comment-c1') => ({ id, type, kind: 'COMMENT', title: `Notification ${id}`, body: 'A comment', href, read: false, createdAt: '2026-10-28T10:00:00.000Z' });
const json = (data: unknown) => new Response(JSON.stringify(data));
beforeEach(() => {
  mocks.push.mockClear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? json({ updated: 1, unreadCount: 1 }) : url.includes('unread-count') ? json({ unreadCount: 2 }) : json({ items: [item('like', 'comment_like'), item('reply', 'comment_reply', null)], unreadCount: 2, nextCursor: null, snapshotAt: '2026-10-28T11:00:00.000Z' }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('notification bell interactions', () => {
  it('shows a distinct decorative event icon and uses client navigation instead of an anchor reload', async () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /Powiadomienia/ }));
    const link = await screen.findByRole('link', { name: /Notification like/ });
    expect(link.closest('li')!.querySelector('[data-notification-type="comment_like"] svg')).not.toBeNull(); // Marker set B, not lucide
    expect(link.closest('li')!.querySelector('svg.lucide')).toBeNull();
    expect(link.closest('li')!.querySelector('svg')?.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(link.closest('ul')!.querySelector('[data-notification-type="comment_reply"] svg')).not.toBeNull();
    const viewAll = await screen.findByRole('link', { name: 'Zobacz wszystkie' });
    expect(viewAll).toHaveAttribute('href', '/powiadomienia');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => url.includes('limit=5'))).toBe(true);
    expect(link).toHaveAttribute('href', '/watch/first#comment-c1');
    fireEvent.click(link);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/watch/first#comment-c1', { scroll: false }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const writes = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ id: 'like' });
  });

  it('opens from the keyboard and returns focus to the bell on Escape', async () => {
    render(<NotificationBell />);
    const bell = screen.getByRole('button', { name: /Powiadomienia/ });
    bell.focus();
    fireEvent.click(bell);
    await screen.findByRole('link', { name: /Notification like/ });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(bell).toHaveFocus());
  });
});

describe('notification panel on phones: a centred popover, never a bottom sheet', () => {
  const phone = (matches: boolean) => { window.matchMedia = vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }); };
  const open = async () => { fireEvent.click(screen.getByRole('button', { name: /Powiadomienia/ })); await screen.findByRole('link', { name: /Notification like/ }); return screen.getByRole('dialog'); };

  it('is centred on the screen below 768 px and aligned to the bell above it', async () => {
    phone(true);
    const { unmount } = render(<NotificationBell />);
    const dialog = await open();
    expect(dialog.parentElement).toHaveAttribute('data-align', 'center');
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(document.querySelector('[data-notification-sheet]')).toBeNull();
    unmount(); cleanup();
    phone(false);
    render(<NotificationBell />);
    expect((await open()).parentElement).toHaveAttribute('data-align', 'end');
  });

  it('has no bottom sheet code and sizes the phone popover from the viewport and the top bar', () => {
    const bell = readFileSync('app/components/notifications/NotificationBell.tsx', 'utf8');
    const css = readFileSync('app/components/notifications/notification-panel.module.css', 'utf8');
    expect(bell).not.toMatch(/Drawer|NotificationSheet/);
    expect(css).not.toMatch(/sheet/i);
    expect(css).toMatch(/max-width: 767\.98px[\s\S]*width: min\(440px, calc\(100vw - 16px - 2 \* max\(env\(safe-area-inset-left, 0px\), env\(safe-area-inset-right, 0px\)\)\)\)[\s\S]*100dvh - var\(--header-h, 47px\) - 16px/);
  });
});
