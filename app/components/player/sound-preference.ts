/**
 * The viewer's sound choice, remembered in this browser (localStorage) so a reload, a new tab or a
 * later visit restores it: `muted` (true = the viewer muted the player, false = the viewer heard
 * the sound and kept it, null = no choice yet) and the `volume` they set.
 *
 * Written only by actions the viewer took (mute button, "m", unmute hint or slider, the click on
 * the entry gate, picking a video from the playlist). A muted start forced by the browser's
 * autoplay policy never writes it. What the browser then allows is a separate matter (see
 * docs/operations/PLAYER-SOUND.md): a remembered "sound on" is only a request to TRY sound first.
 */
const STORAGE_KEY = "polutek:player-sound";

export type SoundPreference = { muted: boolean | null; volume: number | null };

// Mirror for the current document, so the choice still holds for the tab when storage is blocked.
let memory: SoundPreference | null = null;

function sanitize(value: unknown): SoundPreference {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const volume = typeof raw.volume === "number" && Number.isFinite(raw.volume) && raw.volume > 0 && raw.volume <= 1 ? raw.volume : null;
  return { muted: typeof raw.muted === "boolean" ? raw.muted : null, volume };
}

export function readSoundPreference(): SoundPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return (memory = sanitize(JSON.parse(stored)));
  } catch {
    // Blocked storage or a damaged value: fall through to the in-document mirror.
  }
  return memory ?? { muted: null, volume: null };
}

function update(patch: Partial<SoundPreference>): void {
  memory = { ...readSoundPreference(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Private mode or blocked storage: the choice then lasts only for this document.
  }
}

/** True when the viewer muted the player themselves. */
export function readUserMuted(): boolean {
  return readSoundPreference().muted === true;
}

/** True when the viewer has heard the sound and kept it (not just "no choice yet"). */
export function readSoundWanted(): boolean {
  return readSoundPreference().muted === false;
}

export function writeUserMuted(muted: boolean): void {
  update({ muted });
}

/** Remembers the volume the viewer set (0 is a mute, not a volume, and is ignored). */
export function writeVolume(volume: number): void {
  if (!(volume > 0 && volume <= 1)) return;
  if (readSoundPreference().volume === volume) return;
  update({ volume });
}

/** @internal test helper */
export function resetSoundPreferenceForTests(): void {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * False only when the browser says outright that sound autoplay is not allowed
 * (`navigator.getAutoplayPolicy`, Firefox and newer Chromium): trying would only fail, and in
 * Firefox flash its "autoplay blocked" icon. Browsers without the API are simply tried.
 */
export function mayTryAudibleAutoplay(): boolean {
  try {
    const nav = navigator as Navigator & { getAutoplayPolicy?: (type: "mediaelement") => string };
    if (typeof nav.getAutoplayPolicy !== "function") return true;
    return nav.getAutoplayPolicy("mediaelement") === "allowed";
  } catch {
    return true;
  }
}
