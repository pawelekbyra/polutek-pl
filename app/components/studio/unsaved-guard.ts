/**
 * One flag for "the Studio has work that would be lost" (an edited video form, a running upload). The editor and
 * the upload wizard set it; the Studio navigation and the in-page "back" buttons read it before they leave.
 * `beforeunload` covers reload and closing the tab while the flag is set.
 */

let dirty = false;
let listening = false;

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty) return;
  event.preventDefault();
  // Legacy browsers need a returnValue to show their own prompt.
  event.returnValue = "";
}

export function setUnsavedWork(value: boolean): void {
  dirty = value;
  if (typeof window === "undefined") return;
  if (value && !listening) {
    window.addEventListener("beforeunload", onBeforeUnload);
    listening = true;
  } else if (!value && listening) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    listening = false;
  }
}

export function hasUnsavedWork(): boolean {
  return dirty;
}

/** True when it is fine to leave: nothing unsaved, or the user confirmed. */
export function confirmLeave(message: string): boolean {
  if (!dirty) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
