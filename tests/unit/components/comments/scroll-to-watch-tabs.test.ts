/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrollToWatchTabs } from '@/app/components/comments/scroll-to-watch-tabs';

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
