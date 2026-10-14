/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import MySubscriptionsList, { type MySubscriptionRow } from '@/app/components/subscriptions/MySubscriptionsList';
import { txFor } from '../../i18n/mock-language';

vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ tx: txFor('en'), language: 'en' }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// The bell is hidden in production (lib/ui-flags.ts); these tests exercise it with the flag on.
vi.mock('@/lib/ui-flags', () => ({ SHOW_SUBSCRIPTION_BELL: true }));

const rows: MySubscriptionRow[] = [
  { creatorId: 'c1', slug: 'one', handle: 'one', name: 'Channel One', imageUrl: null, notify: true, videosCount: 3, lastVideoAt: '2026-10-10T10:00:00.000Z', available: true },
  { creatorId: 'c2', slug: 'two', handle: null, name: 'Channel Two', imageUrl: null, notify: false, videosCount: 0, lastVideoAt: null, available: false },
];

describe('MySubscriptionsList', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows name, handle and video count; an unavailable channel has no link', () => {
    render(<MySubscriptionsList initialRows={rows} />);

    expect(screen.getByRole('link', { name: 'Channel One' }).getAttribute('href')).toBe('/en/channel/one');
    expect(screen.getByText(/@one/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Channel Two' })).toBeNull();
    expect(screen.getByText(/channel unavailable/)).toBeTruthy();
  });

  it('toggles the bell of one channel with PATCH and keeps the new state', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<MySubscriptionsList initialRows={rows} />);

    fireEvent.click(screen.getByRole('button', { name: /Notifications: on: Channel One/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/subscriptions');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ creatorId: 'c1', notify: false });
    await waitFor(() => expect(screen.getByRole('button', { name: /Notifications: off: Channel One/ })).toBeTruthy());
  });

  it('rolls the bell back and shows an error when the API fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    render(<MySubscriptionsList initialRows={rows} />);

    fireEvent.click(screen.getByRole('button', { name: /Notifications: on: Channel One/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Notifications: on: Channel One/ })).toBeTruthy();
  });

  it('unsubscribes with DELETE for that channel and removes the row', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<MySubscriptionsList initialRows={rows} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Unsubscribe' })[0]);

    await waitFor(() => expect(screen.queryByText('Channel One')).toBeNull());
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ creatorId: 'c1' });
    expect(screen.getByText('Channel Two')).toBeTruthy();
  });

  it('shows an empty state without subscriptions', () => {
    render(<MySubscriptionsList initialRows={[]} />);

    expect(screen.getByText('You are not subscribed to any channel yet.')).toBeTruthy();
  });
});
