/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationsSection } from '@/app/components/auth/NotificationsSection';
import { txFor } from '../i18n/mock-language';

vi.mock('@/app/components/auth/AccountSections', () => ({
  Feedback: ({ error }: { error: string | null }) => error ? <p role="alert">{error}</p> : null,
}));
const original = { newVideoInApp: true, commentEnabled: true, systemEnabled: true };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('notification preferences saves', () => {
  it('serializes changes so a delayed response cannot overwrite another toggle', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(original)))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    render(<NotificationsSection tx={txFor('pl')} />);
    const switches = await screen.findAllByRole('switch');
    fireEvent.click(switches[0]);
    for (const toggle of switches) expect(toggle).toHaveProperty('disabled', true);
    fireEvent.click(switches[1]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => finish(new Response(JSON.stringify({ ...original, newVideoInApp: false }))));
    await waitFor(() => expect(switches[0]).toHaveProperty('disabled', false));
    expect(switches[0]).toHaveProperty('checked', false);
    expect(switches[1]).toHaveProperty('checked', true);
    expect(switches[2]).toHaveProperty('checked', true);
  });

  it('unlocks controls and restores the value when a request never answers', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(original)))
      .mockImplementationOnce((_url, options: RequestInit) => new Promise((_resolve, reject) => {
        options.signal!.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
      }));
    vi.stubGlobal('fetch', fetcher);
    render(<NotificationsSection tx={txFor('pl')} />);
    const switches = await screen.findAllByRole('switch');
    vi.useFakeTimers();
    fireEvent.click(switches[0]);
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(screen.getByRole('alert')).not.toBeNull();
    for (const toggle of switches) expect(toggle).toHaveProperty('disabled', false);
    expect(switches[0]).toHaveProperty('checked', true);
  });

  it('restores the changed preference and unlocks all controls when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(original)))
      .mockResolvedValueOnce(new Response('{}', { status: 503 })));
    render(<NotificationsSection tx={txFor('pl')} />);
    const switches = await screen.findAllByRole('switch');
    fireEvent.click(switches[1]);
    await screen.findByRole('alert');
    for (const toggle of switches) {
      expect(toggle).toHaveProperty('disabled', false);
      expect(toggle).toHaveProperty('checked', true);
    }
  });
});
