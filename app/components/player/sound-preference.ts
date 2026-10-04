/**
 * The viewer's own mute choice for this browser tab (sessionStorage). A video the viewer picks
 * starts with sound, unless the viewer muted the player themselves earlier in the session: then
 * the next video stays muted too. Only explicit actions (the mute button, the "m" key, the
 * unmute hint) write it; a muted start forced by the browser's autoplay policy never does.
 */
const STORAGE_KEY = "polutek:player-muted";

export function readUserMuted(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeUserMuted(muted: boolean): void {
  try {
    if (muted) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the choice then lasts only for the current video.
  }
}
