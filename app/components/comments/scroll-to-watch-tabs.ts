export const WATCH_TABS_ID = "watch-tabs";

/**
 * Scrolls the KOMENTARZE/FILMY tab row to just below the sticky navbar.
 * Returns false when the row is not laid out (e.g. desktop, where it is hidden).
 */
export function scrollToWatchTabs(behavior: ScrollBehavior): boolean {
  const tabs = document.getElementById(WATCH_TABS_ID);
  if (!tabs || tabs.getClientRects().length === 0) return false;
  const navHeight = document.querySelector("header.polutek-watch-nav")?.getBoundingClientRect().height ?? 0;
  const top = tabs.getBoundingClientRect().top + window.scrollY - navHeight;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}
