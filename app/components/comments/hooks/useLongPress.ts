"use client";

import { useCallback, useEffect, useRef } from "react";

const LONG_PRESS_MS = 450;
/** A finger that travels farther than this is scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Touch long-press (about half a second without moving) for an element. Mouse and pen are ignored on purpose:
 * on a desktop the visible actions button does the job. After a long press fires, the browser's own context menu
 * / text selection that would follow is suppressed once.
 */
export function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || event.pointerType !== "touch") return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        navigator.vibrate?.(10);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [enabled, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      if (!origin) return;
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    if (!fired.current) return;
    fired.current = false;
    event.preventDefault();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel, onContextMenu };
}
