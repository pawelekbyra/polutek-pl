const SAMPLE_BYTES = 32 * 1024;
const DRAFT_KEY_PREFIX = "studio-upload-draft:v1:";

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Hashes file metadata and bounded first/last samples, avoiding a full read of large video files. */
export async function studioFileIdentity(file: Blob & { name?: string; lastModified?: number }, fileName = file.name ?? ""): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Ta przeglądarka nie obsługuje bezpiecznego wznawiania uploadu.");
  const sampleStarts = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.min(Math.max(0, file.size - SAMPLE_BYTES), Math.floor((file.size - SAMPLE_BYTES) * fraction)));
  const chunks = await Promise.all(sampleStarts.map(async (start) => new Uint8Array(await file.slice(start, start + SAMPLE_BYTES).arrayBuffer())));
  const metadata = new TextEncoder().encode(`${fileName}\0${file.size}\0${file.lastModified ?? 0}\0`);
  const sample = new Uint8Array(metadata.length + chunks.reduce((total, chunk) => total + chunk.length, 0));
  sample.set(metadata);
  let offset = metadata.length;
  for (const chunk of chunks) {
    sample.set(chunk, offset);
    offset += chunk.length;
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sample));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function draftKey(identity: string): string {
  return `${DRAFT_KEY_PREFIX}${identity}`;
}

export async function rememberedStudioDraft(file: File): Promise<string | null> {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const identity = await studioFileIdentity(file);
    const videoId = storage.getItem(draftKey(identity));
    return videoId && videoId.length <= 200 ? videoId : null;
  } catch {
    return null;
  }
}

export async function rememberStudioDraft(file: File, videoId: string): Promise<void> {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(draftKey(await studioFileIdentity(file)), videoId);
  } catch {
    // Storage may be unavailable or full; the current page can still resume from component state.
  }
}

export async function forgetStudioDraft(file: File): Promise<void> {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.removeItem(draftKey(await studioFileIdentity(file)));
  } catch {
    // The server upload can still be completed; a later attempt may create a fresh draft.
  }
}
