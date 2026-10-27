/**
 * Single-character shortcuts (g…, ?, /, [ ], j k h z p w) can be switched off by the operator (WCAG 2.1.4): a voice
 * or switch tool that sends single letters must not be able to hide a comment. The choice lives in this browser only
 * and defaults to on; Ctrl/Cmd+K and Escape are modifier or non-printing keys and always work.
 */
export const SINGLE_KEY_SHORTCUTS_KEY = "pp-admin-single-key-shortcuts";
export const SINGLE_KEY_SHORTCUTS_EVENT = "pp-admin-single-key-shortcuts";

export function readSingleKeyShortcuts(): boolean {
  try {
    return localStorage.getItem(SINGLE_KEY_SHORTCUTS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSingleKeyShortcuts(on: boolean): void {
  try {
    if (on) localStorage.removeItem(SINGLE_KEY_SHORTCUTS_KEY);
    else localStorage.setItem(SINGLE_KEY_SHORTCUTS_KEY, "off");
  } catch {
    // Without storage the choice lasts only until the tab closes.
  }
  window.dispatchEvent(new CustomEvent(SINGLE_KEY_SHORTCUTS_EVENT, { detail: on }));
}
