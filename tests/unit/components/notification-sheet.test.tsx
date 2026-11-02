/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationBell from '@/app/components/notifications/NotificationBell';
import { NOTIFICATION_SHEET_QUERY } from '@/app/components/notifications/use-notification-sheet';
import { txFor } from '../i18n/mock-language';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/lib/auth/react', () => ({ useAuth: () => ({ userId: 'u1' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));

const item = (id: string, href: string | null = '/watch/first#comment-c1') => ({ id, type: 'comment_like', kind: 'COMMENT', title: `Notification ${id}`, body: 'A comment', href, read: false, createdAt: '2026-10-28T10:00:00.000Z' });
const json = (data: unknown) => new Response(JSON.stringify(data));

/** A controllable matchMedia: `phone` decides the sheet query, every other query is false. */
function installMedia(phone: boolean) {
  const listeners = new Set<() => void>();
  const state = { phone };
  window.matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() { return query === NOTIFICATION_SHEET_QUERY ? state.phone : false; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return { setPhone(value: boolean) { act(() => { state.phone = value; listeners.forEach((fn) => fn()); }); } };
}

beforeEach(() => {
  mocks.push.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? json({ updated: 1, unreadCount: 1 }) : url.includes('unread-count') ? json({ unreadCount: 2 }) : json({ items: [item('a'), item('b', null)], unreadCount: 2, nextCursor: null, snapshotAt: '2026-10-28T11:00:00.000Z' }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const bell = () => screen.getByRole('button', { name: /Powiadomienia/ });
const openPanel = async () => { fireEvent.click(bell()); await screen.findByRole('link', { name: /Notification a/ }); return screen.getByRole('dialog'); };

describe('notification panel: popover on wide screens, bottom sheet on phones', () => {
  it('keeps the anchored popover from 768 px up (no sheet parts)', async () => {
    installMedia(false);
    render(<NotificationBell />);
    const dialog = await openPanel();
    expect(dialog).not.toHaveAttribute('data-notification-sheet');
    expect(document.querySelector('[data-notification-sheet]')).toBeNull();
  });

  it('opens a modal bottom sheet below 768 px with a name, a hint and a grabber', async () => {
    installMedia(true);
    render(<NotificationBell />);
    const dialog = await openPanel();
    expect(dialog).toHaveAttribute('data-notification-sheet');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = screen.getByRole('heading', { name: 'Powiadomienia' });
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog).toHaveAccessibleDescription(/Przeciągnij uchwyt w dół/);
    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
  });

  it('puts the focus in the sheet and returns it to the bell on Escape', async () => {
    installMedia(true);
    render(<NotificationBell />);
    bell().focus();
    const dialog = await openPanel();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(bell()).toHaveFocus());
  });

  it('closes with the close button and returns the focus to the bell', async () => {
    installMedia(true);
    render(<NotificationBell />);
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(bell()).toHaveFocus());
  });

  it('closes on a press on the scrim (outside the sheet)', async () => {
    installMedia(true);
    render(<NotificationBell />);
    const dialog = await openPanel();
    const viewport = dialog.parentElement!;
    fireEvent.pointerDown(viewport); fireEvent.mouseDown(viewport); fireEvent.pointerUp(viewport); fireEvent.mouseUp(viewport); fireEvent.click(viewport);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('locks the page scroll while open and restores it on close', async () => {
    installMedia(true);
    render(<NotificationBell />);
    const style = () => document.documentElement.style.cssText + '|' + document.body.style.cssText;
    const before = style();
    const dialog = await openPanel();
    await waitFor(() => expect(style()).not.toBe(before));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(style()).toBe(before));
  });

  it('uses its own history entry: Back closes the sheet, other ways of closing pop the entry again', async () => {
    installMedia(true);
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back');
    render(<NotificationBell />);
    await openPanel();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toHaveProperty("notificationSheet");
    expect(push.mock.calls[0][2]).toBeUndefined(); // same URL
    expect(window.history.state).toHaveProperty("notificationSheet");
    const entry = window.history.state.notificationSheet;
    const backCalls = back.mock.calls.length;
    act(() => { window.history.back(); }); // the user pressed Back (jsdom traverses and fires popstate)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(back.mock.calls.length).toBe(backCalls + 1); // only the user's own call: the sheet did not pop a second entry
    expect(window.history.state?.notificationSheet).not.toBe(entry);
    const second = await openPanel();
    const secondEntry = window.history.state.notificationSheet;
    fireEvent.keyDown(second, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(back.mock.calls.length).toBe(backCalls + 2); // closing another way pops the extra entry
    await waitFor(() => expect(window.history.state?.notificationSheet).not.toBe(secondEntry));
  });

  it('does not touch the history on wide screens', async () => {
    installMedia(false);
    const push = vi.spyOn(window.history, 'pushState');
    render(<NotificationBell />);
    await openPanel();
    expect(push).not.toHaveBeenCalled();
  });

  it('follows a notification only after the sheet is gone (scroll lock released first)', async () => {
    installMedia(true);
    render(<NotificationBell />);
    await openPanel();
    fireEvent.click(screen.getByRole('link', { name: /Notification a/ }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/watch/first#comment-c1', { scroll: false }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches popover and sheet while open (rotation) and stays open, without a slide', async () => {
    const media = installMedia(true);
    render(<NotificationBell />);
    await openPanel();
    media.setPhone(false);
    await waitFor(() => expect(screen.getByRole('dialog')).not.toHaveAttribute('data-notification-sheet'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-instant');
    expect(screen.getByRole('link', { name: /Notification a/ })).toBeInTheDocument();
    media.setPhone(true);
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-notification-sheet'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-instant');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
