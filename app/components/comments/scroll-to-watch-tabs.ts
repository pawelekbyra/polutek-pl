export const WATCH_TABS_ID = "watch-tabs";

/** How long to wait for the on-screen keyboard to leave before scrolling anyway. */
const KEYBOARD_WAIT_MS = 700;
/** The keyboard counts as open when it covers more than this many px of the layout viewport. */
const KEYBOARD_MIN_PX = 60;
/** When to look once more whether late layout changes moved the row off its place. */
const CORRECTION_AFTER_MS = 800;

function tabRow(): HTMLElement | null {
  const tabs = document.getElementById(WATCH_TABS_ID);
  return tabs && tabs.getClientRects().length > 0 ? tabs : null;
}

function navHeight(): number {
  return document.querySelector("header.polutek-watch-nav")?.getBoundingClientRect().height ?? 0;
}

/**
 * Scrolls the KOMENTARZE/FILMY tab row to just below the sticky navbar.
 * Returns false when the row is not laid out (e.g. desktop, where it is hidden).
 */
export function scrollToWatchTabs(behavior: ScrollBehavior): boolean {
  const tabs = tabRow();
  if (!tabs) return false;
  const top = tabs.getBoundingClientRect().top + window.scrollY - navHeight();
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}

/**
 * Same target, but safe to call right after sending from the phone composer: the keyboard is still leaving at that
 * moment and the browser shifts the page while the layout viewport grows back, which used to leave the tab row
 * too low (the video description showing above it). It waits for the keyboard to go, scrolls instantly if the
 * keyboard was up, and checks once more after things have settled.
 */
export function scrollToWatchTabsWhenSettled(behavior: ScrollBehavior): boolean {
  if (!tabRow()) return false;
  const viewport = window.visualViewport;
  const keyboardOpen = () => !!viewport && window.innerHeight - viewport.height - viewport.offsetTop > KEYBOARD_MIN_PX;
  const hadKeyboard = keyboardOpen();
  const startedAt = Date.now();

  const settle = () => {
    if (keyboardOpen() && Date.now() - startedAt < KEYBOARD_WAIT_MS) {
      setTimeout(settle, 50);
      return;
    }
    scrollToWatchTabs(hadKeyboard ? "auto" : behavior);
    setTimeout(() => {
      const tabs = tabRow();
      if (tabs && Math.abs(tabs.getBoundingClientRect().top - navHeight()) > 4) scrollToWatchTabs("auto");
    }, CORRECTION_AFTER_MS);
  };
  settle();
  return true;
}
