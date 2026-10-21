/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/app/components/LanguageContext', async () => {
  const { txFor } = await import('../i18n/mock-language');
  return { useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: {} }) };
});
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => React.createElement('img', { src: props.src, alt: props.alt }),
}));

import { FavoritesShelf } from '@/app/components/channel/FavoritesShelf';

const item = (n: number) => ({ videoId: `vid-${n}`, slug: `film-${n}`, title: `Film ${n}`, titleEn: null, thumbnailUrl: `/api/videos/vid-${n}/thumbnail`, channelName: 'Kanał' });
const reply = (items: unknown[]) => new Response(JSON.stringify({ items }), { status: 200 });

describe('FavoritesShelf', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders nothing while the list is empty', async () => {
    fetchMock.mockResolvedValue(reply([]));
    const view = render(<FavoritesShelf onSelect={() => undefined} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/user/favorites', expect.anything()));
    expect(view.container.firstChild).toBeNull();
  });

  it('lists the favorites as links and opens one in place on a plain click', async () => {
    fetchMock.mockResolvedValue(reply([item(1), item(2)]));
    const onSelect = vi.fn();
    render(<FavoritesShelf onSelect={onSelect} />);

    expect(await screen.findByRole('heading', { name: 'Ulubione (2)' })).toBeTruthy();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/?v=film-1');
    fireEvent.click(links[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'vid-1', slug: 'film-1' }));
  });

  it('reloads when a favorite was saved or removed, and folds long lists behind "Pokaż wszystkie"', async () => {
    fetchMock.mockResolvedValueOnce(reply([item(1)]));
    render(<FavoritesShelf onSelect={() => undefined} />);
    await screen.findByRole('heading', { name: 'Ulubione (1)' });

    fetchMock.mockResolvedValueOnce(reply([1, 2, 3, 4, 5, 6, 7, 8].map(item)));
    window.dispatchEvent(new CustomEvent('polutek:favorites-changed'));
    await screen.findByRole('heading', { name: 'Ulubione (8)' });
    expect(screen.getAllByRole('link')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie' }));
    expect(screen.getAllByRole('link')).toHaveLength(8);
  });
});
