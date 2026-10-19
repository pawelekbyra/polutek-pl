/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { useLongPress } from '@/app/components/comments/hooks/useLongPress';

afterEach(() => vi.useRealTimers());

const touch = (x = 10, y = 10) => ({ pointerType: 'touch', clientX: x, clientY: y }) as unknown as React.PointerEvent;

describe('useLongPress', () => {
  it('fires after a held touch and suppresses the browser context menu once', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, true));
    act(() => result.current.onPointerDown(touch()));
    act(() => vi.advanceTimersByTime(400));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    const prevent = vi.fn();
    result.current.onContextMenu({ preventDefault: prevent } as unknown as React.MouseEvent);
    result.current.onContextMenu({ preventDefault: prevent } as unknown as React.MouseEvent);
    expect(prevent).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the finger lifts early, moves (scrolling), or when disabled / not a touch', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result, rerender } = renderHook(({ on }) => useLongPress(onLongPress, on), { initialProps: { on: true } });

    act(() => result.current.onPointerDown(touch()));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onPointerUp());
    act(() => vi.advanceTimersByTime(600));

    act(() => result.current.onPointerDown(touch(10, 10)));
    act(() => result.current.onPointerMove(touch(10, 40)));
    act(() => vi.advanceTimersByTime(600));

    act(() => result.current.onPointerDown({ pointerType: 'mouse', clientX: 1, clientY: 1 } as unknown as React.PointerEvent));
    act(() => vi.advanceTimersByTime(600));

    rerender({ on: false });
    act(() => result.current.onPointerDown(touch()));
    act(() => vi.advanceTimersByTime(600));

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
