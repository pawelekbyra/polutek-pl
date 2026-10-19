/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrollToWatchTabs, scrollToWatchTabsWhenSettled } from '@/app/components/comments/scroll-to-watch-tabs';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('scrollToWatchTabs', () => {
  it('returns false when the tab row is missing or not laid out', () => {
    expect(scrollToWatchTabs('auto')).toBe(false);
    document.body.innerHTML = '<div id="watch-tabs"></div>';
    expect(scrollToWatchTabs('auto')).toBe(false);
  });

  it('scrolls so the tab row sits just below the navbar', () => {
    document.body.innerHTML = '<header class="polutek-watch-nav"></header><div id="watch-tabs"></div>';
    const tabs = document.getElementById('watch-tabs')!;
    tabs.getClientRects = () => [{}] as unknown as DOMRectList;
    tabs.getBoundingClientRect = () => ({ top: 700 }) as DOMRect;
    document.querySelector('header')!.getBoundingClientRect = () => ({ height: 56 }) as DOMRect;
    const spy = vi.fn();
    window.scrollTo = spy as unknown as typeof window.scrollTo;
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    expect(scrollToWatchTabs('smooth')).toBe(true);
    expect(spy).toHaveBeenCalledWith({ top: 944, behavior: 'smooth' });
  });
});

describe('scrollToWatchTabsWhenSettled', () => {
  function layOutTabs(top: () => number) {
    document.body.innerHTML = '<header class="polutek-watch-nav"></header><div id="watch-tabs"></div>';
    const tabs = document.getElementById('watch-tabs')!;
    tabs.getClientRects = () => [{}] as unknown as DOMRectList;
    tabs.getBoundingClientRect = () => ({ top: top() }) as DOMRect;
    document.querySelector('header')!.getBoundingClientRect = () => ({ height: 56 }) as DOMRect;
  }

  it('returns false when there is no tab row (the caller falls back)', () => {
    expect(scrollToWatchTabsWhenSettled('smooth')).toBe(false);
  });

  it('waits for the keyboard to leave, then scrolls instantly and corrects once if the row drifted', () => {
    vi.useFakeTimers();
    const viewport = { height: 500, offsetTop: 0 }; // like the real VisualViewport: one live object
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    let top = 500;
    layOutTabs(() => top);
    const spy = vi.fn();
    window.scrollTo = spy as unknown as typeof window.scrollTo;

    expect(scrollToWatchTabsWhenSettled('smooth')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();

    viewport.height = 800;
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledWith({ top: 544, behavior: 'auto' });

    top = 90; // late layout change left the row off its place
    vi.advanceTimersByTime(900);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
