import type { Tx } from "@/lib/i18n/ui";
/** Default avatar every new account starts with (public/default-avatar.jpg). */
export const DEFAULT_AVATAR_URL = "/default-avatar.jpg";

/** Largest file a user may pick (before it is resized in the browser). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_TYPES = new Set(AVATAR_ACCEPT.split(","));

/** Avatars are resized to this square in the browser and stored as a small data URL. */
export const AVATAR_SIZE_PX = 256;
/** Upper bound of the uploaded data URL (the resized image is normally 15-40 KB). */
export const AVATAR_MAX_DATA_URL_CHARS = 120_000;

/** Public URL of a stored avatar; `version` changes with every upload so caches never go stale. */
export function avatarRouteUrl(userId: string, version: number = Date.now()): string {
  return `/api/avatars/${encodeURIComponent(userId)}?v=${version}`;
}

export type AvatarProblem = "type" | "size";

export function validateAvatarFile(file: { type: string; size: number }): AvatarProblem | null {
  if (!ALLOWED_TYPES.has(file.type)) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}

export function avatarProblemMessage(problem: AvatarProblem, tx: Tx): string {
  if (problem === "type") return tx("Avatar: dozwolone pliki JPG, PNG lub WebP.", "Avatar: JPG, PNG or WebP files only.");
  return tx("Avatar może mieć najwyżej 2 MB.", "The avatar can be at most 2 MB.");
}

const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Server-side check of an avatar data URL sent by the browser (see validateImageDataUrl). */
export function validateAvatarDataUrl(value: unknown) {
  return validateImageDataUrl(value, AVATAR_MAX_DATA_URL_CHARS);
}

/**
 * Server-side check of an image data URL sent by the browser: right type, plain base64, within `maxChars`,
 * and the decoded bytes start with the matching image signature. Shared by avatars and channel banners.
 */
export function validateImageDataUrl(
  value: unknown,
  maxChars: number,
): { ok: true; value: string; mime: string; bytes: Buffer } | { ok: false } {
  if (typeof value !== "string" || value.length > maxChars) return { ok: false };
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) return { ok: false };
  const bytes = Buffer.from(match[2], "base64");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const signatureOk = match[1] === "jpeg" ? isJpeg : match[1] === "png" ? isPng : isWebp;
  return signatureOk ? { ok: true, value, mime: `image/${match[1]}`, bytes } : { ok: false };
}
