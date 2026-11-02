/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationRow } from '@/app/components/notifications/NotificationRow';

afterEach(cleanup);
const base = { id: 'n1', kind: 'NEW_VIDEO', type: 'new_video', title: 'Nowy film: Test', body: 'Kanał dodał film', href: '/watch/film', read: false, createdAt: '2026-10-28T10:00:00.000Z', videoId: 'v1', videoSlug: 'film', thumbnailUrl: '/api/videos/v1/thumbnail' } as never;
const tx = (pl: string) => pl;
const setup = (item = base, extra: Record<string, unknown> = {}) => {
  const onRead = vi.fn(); const onFollow = vi.fn((event: Event) => event.preventDefault());
  const view = render(<ul><NotificationRow item={item} link={{ href: '/watch/film', external: false }} language="pl" tx={tx as never} now={Date.parse('2026-10-28T11:00:00Z')} pending={false} onRead={onRead} onFollow={onFollow as never} {...extra} /></ul>);
  return { onRead, onFollow, ...view };
};

describe('NotificationRow video thumbnail', () => {
  it('renders a decorative 56x32 lazy cover that is not a second tab stop or screen reader link', () => {
    const { container } = setup();
    const thumb = container.querySelector('[data-notification-thumb]') as HTMLAnchorElement;
    expect(thumb).toBeTruthy();
    expect(thumb.getAttribute('aria-hidden')).toBe('true');
    expect(thumb.tabIndex).toBe(-1);
    const img = thumb.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('56');
    expect(img.getAttribute('height')).toBe('32');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('clicking the cover follows the row link and marks the unread row as read', () => {
    const { container, onRead, onFollow } = setup();
    fireEvent.click(container.querySelector('[data-notification-thumb]')!);
    expect(onRead).toHaveBeenCalledWith(true);
    expect(onFollow).toHaveBeenCalledWith(expect.anything(), '/watch/film', false);
  });

  it('keeps an empty box of the same size when the image fails', () => {
    const { container } = setup();
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-notification-thumb]')).toBeTruthy();
  });

  it('shows no cover without a thumbnail (other types, hidden videos, old servers)', () => {
    expect(setup({ ...(base as object), thumbnailUrl: null, type: 'comment_reply' } as never).container.querySelector('[data-notification-thumb]')).toBeNull();
    cleanup();
    const old = { ...(base as Record<string, unknown>) }; delete old.thumbnailUrl;
    expect(setup(old as never).container.querySelector('[data-notification-thumb]')).toBeNull();
  });
});
