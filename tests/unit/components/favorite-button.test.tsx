/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import FavoriteButton from '@/app/components/FavoriteButton';
import { txFor } from '../i18n/mock-language';

const toast = vi.fn();
const openAuth = vi.fn();
const auth = { userId: 'user_1' as string | null };

vi.mock('@/lib/auth/react', () => ({ useAuth: () => auth }));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: openAuth, close: vi.fn(), isOpen: false }),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: {} }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const sentStates = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PUT')
    .map((call) => (JSON.parse(String((call[1] as RequestInit).body)) as { favorite: boolean }).favorite);

describe('FavoriteButton', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    toast.mockClear();
    openAuth.mockClear();
    fetchMock.mockReset();
    auth.userId = 'user_1';
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the server state with an accessible, pressed-aware label', () => {
    const view = render(<FavoriteButton videoId="v1" initialFavorited />);
    const button = screen.getByRole('button', { name: 'Usuń z ulubionych' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    view.rerender(<FavoriteButton videoId="v1" initialFavorited={false} />);
    expect(screen.getByRole('button', { name: 'Dodaj do ulubionych' })).toHaveAttribute('aria-pressed', 'false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saves optimistically, sends the wanted state and tells the shelf to reload', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ favorited: true }), { status: 200 }));
    const changed = vi.fn();
    window.addEventListener('polutek:favorites-changed', changed);
    render(<FavoriteButton videoId="v1" initialFavorited={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do ulubionych' }));
    expect(screen.getByRole('button', { name: 'Usuń z ulubionych' })).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/videos/v1/favorite');
    expect(sentStates(fetchMock)).toEqual([true]);
    expect(toast).not.toHaveBeenCalled();
    window.removeEventListener('polutek:favorites-changed', changed);
  });

  it('rolls back and shows a toast when the request fails', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    render(<FavoriteButton videoId="v1" initialFavorited={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do ulubionych' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Nie udało się zapisać ulubionych. Spróbuj ponownie.', 'error'));
    expect(screen.getByRole('button', { name: 'Dodaj do ulubionych' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('ends in the state the viewer last chose when clicked rapidly', async () => {
    const resolvers: Array<() => void> = [];
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const { favorite } = JSON.parse(String(init.body)) as { favorite: boolean };
      return new Promise<Response>((resolve) => resolvers.push(() => resolve(new Response(JSON.stringify({ favorited: favorite }), { status: 200 }))));
    });
    render(<FavoriteButton videoId="v1" initialFavorited={false} />);
    const button = () => screen.getByRole('button');

    fireEvent.click(button()); // on
    fireEvent.click(button()); // off
    fireEvent.click(button()); // on
    expect(button()).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolvers[0]();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    resolvers[1]();

    await waitFor(() => expect(sentStates(fetchMock)).toEqual([true, true]));
    expect(button()).toHaveAttribute('aria-pressed', 'true');
    expect(toast).not.toHaveBeenCalled();
  });

  it('a signed-out click opens the sign-in window and sends nothing', () => {
    auth.userId = null;
    render(<FavoriteButton videoId="v1" initialFavorited={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do ulubionych' }));
    expect(openAuth).toHaveBeenCalledWith('sign-in');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 401 from the server restores the state and opens the sign-in window', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    render(<FavoriteButton videoId="v1" initialFavorited={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do ulubionych' }));
    await waitFor(() => expect(openAuth).toHaveBeenCalledWith('sign-in'));
    expect(screen.getByRole('button', { name: 'Dodaj do ulubionych' })).toHaveAttribute('aria-pressed', 'false');
    expect(toast).not.toHaveBeenCalled();
  });

  it('asks the API for the state when the server did not deliver one (shallow video switch)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ favorited: true }), { status: 200 }));
    render(<FavoriteButton videoId="v2" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Usuń z ulubionych' })).toHaveAttribute('aria-pressed', 'true'));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/videos/v2/favorite');
  });
});
