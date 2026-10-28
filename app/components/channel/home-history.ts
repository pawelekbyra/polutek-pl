/** Local video selections survive Back/Forward without a server navigation. */
export const VIDEO_HISTORY_STATE_KEY = "polutekVideoId";
export function readHistoryVideoId(state: unknown): string | undefined {
  if (!state || typeof state !== "object") return undefined;
  const value = (state as Record<string, unknown>)[VIDEO_HISTORY_STATE_KEY];
  return typeof value === "string" ? value : undefined;
}

export type ChannelViewState = {
  routeVideoId: string | undefined;
  selectedVideoId: string | undefined;
  activeTab: "comments" | "videos";
  /**
   * The selected video was picked with a click or tap (a user gesture, so the browser lets it
   * start with sound). Never set for the first video, a route change or Back/Forward.
   */
  startWithSound: boolean;
};

export function scrollToMediaOnMobile() {
  if (typeof window === "undefined") return;

  const isMobileLayout = window.matchMedia?.("(max-width: 1023px)").matches ?? true;
  if (!isMobileLayout) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}
