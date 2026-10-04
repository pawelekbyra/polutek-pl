"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/**
 * The clock for relative dates ("3 months ago") in server-rendered UI. The server renders with its
 * own "now" and passes it here (ISO), so hydration renders exactly the same text instead of an
 * empty slot that fills in after hydration. Once hydrated, the live clock is used; the text only
 * changes if the time crossed a unit (rare).
 */
const RenderClockContext = createContext<string | null>(null);

export function RenderClockProvider({ renderedAt, children }: { renderedAt?: string | null; children: ReactNode }) {
  return <RenderClockContext.Provider value={renderedAt ?? null}>{children}</RenderClockContext.Provider>;
}

const noopSubscribe = () => () => {};

/**
 * "Now" for relative dates: the server's render time while rendering on the server and during
 * hydration, the live time afterwards. Null when there is no server time (then show nothing
 * until hydrated, as before).
 */
export function useRenderClock(): Date | null {
  const renderedAt = useContext(RenderClockContext);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (hydrated) return new Date();
  if (!renderedAt) return null;
  const serverNow = new Date(renderedAt);
  return Number.isNaN(serverNow.getTime()) ? null : serverNow;
}
