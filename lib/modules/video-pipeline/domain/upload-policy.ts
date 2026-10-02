/**
 * Rules for original video uploads (admin -> private R2 bucket `polutek`, multipart, resumable).
 * Pure: the use cases and the browser both import it, so limits live in one place.
 */

export const MIB = 1024 * 1024;
export const GIB = 1024 * MIB;

/** R2/S3 multipart limits: parts of 5 MiB .. 5 GiB (the last part may be smaller), at most 10 000 parts. */
export const MIN_PART_SIZE = 5 * MIB;
export const MAX_PARTS = 10_000;
/** Smaller parts mean more requests; 16 MiB keeps a 10 GiB file at 640 parts. */
export const PREFERRED_PART_SIZE = 16 * MIB;
export const MIN_FILE_BYTES = 64 * 1024;
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * GIB;
export const MAX_PARTS_PER_PRESIGN = 50;
export const PART_URL_TTL_SECONDS = 2 * 60 * 60;

/** Upload size ceiling; override with VIDEO_UPLOAD_MAX_BYTES (never above 50 GiB, the server disk is 75 GB). */
export function maxUploadBytes(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.VIDEO_UPLOAD_MAX_BYTES);
  if (Number.isFinite(raw) && raw >= MIB) return Math.min(Math.floor(raw), 50 * GIB);
  return DEFAULT_MAX_UPLOAD_BYTES;
}

/** Video containers ffmpeg can read and that we accept as sources. Audio-only and images are rejected. */
export const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "mkv", "avi", "ts", "mts", "m2ts"] as const;
export type VideoExtension = (typeof ALLOWED_VIDEO_EXTENSIONS)[number];

const GENERIC_CONTENT_TYPES = new Set(["application/octet-stream", "binary/octet-stream", ""]);

export interface UploadRequest {
  fileName?: string;
  fileSize?: number;
  contentType?: string;
}

export interface ValidatedUpload {
  extension: VideoExtension;
  fileSize: number;
  /** Normalised declared type (stored on the object; the sniffed container is authoritative). */
  contentType: string;
}

export type UploadValidation = { ok: true; value: ValidatedUpload } | { ok: false; code: string; message: string };

export function validateUploadRequest(input: UploadRequest, limit: number = maxUploadBytes()): UploadValidation {
  const name = (input.fileName ?? "").trim();
  const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (!(ALLOWED_VIDEO_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ok: false, code: "UPLOAD_BAD_TYPE", message: `Dozwolone formaty: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.` };
  }
  const size = input.fileSize;
  if (typeof size !== "number" || !Number.isFinite(size) || !Number.isInteger(size) || size < MIN_FILE_BYTES) {
    return { ok: false, code: "UPLOAD_BAD_SIZE", message: "Plik jest pusty albo ma niepoprawny rozmiar." };
  }
  if (size > limit) {
    return { ok: false, code: "UPLOAD_TOO_LARGE", message: `Plik jest za duży (limit ${Math.round(limit / GIB)} GiB).` };
  }
  const contentType = (input.contentType ?? "").trim().toLowerCase();
  const okType = GENERIC_CONTENT_TYPES.has(contentType) || contentType.startsWith("video/") || contentType === "application/x-matroska";
  if (!okType) {
    return { ok: false, code: "UPLOAD_BAD_TYPE", message: "To nie wygląda na plik wideo." };
  }
  return { ok: true, value: { extension: extension as VideoExtension, fileSize: size, contentType: contentType || "application/octet-stream" } };
}

/** Part size and count for a file: >= 16 MiB, grown in MiB steps so it never exceeds 10 000 parts. */
export function planParts(fileSize: number): { partSize: number; partCount: number } {
  let partSize = PREFERRED_PART_SIZE;
  const needed = Math.ceil(fileSize / MAX_PARTS / MIB) * MIB;
  if (needed > partSize) partSize = needed;
  return { partSize, partCount: Math.max(1, Math.ceil(fileSize / partSize)) };
}

export function isValidPartNumbers(partNumbers: number[], partCount: number): boolean {
  return (
    partNumbers.length > 0 &&
    partNumbers.length <= MAX_PARTS_PER_PRESIGN &&
    partNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= partCount)
  );
}

export type SniffedContainer = "mp4" | "matroska" | "avi" | "mpegts" | "m2ts";

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

/** Atom types a QuickTime/MP4 file may legally start with. */
const MP4_FIRST_ATOMS = new Set(["ftyp", "moov", "mdat", "free", "skip", "wide", "pnot"]);

/**
 * Identifies a video container from the first bytes (magic bytes), independent of the file name
 * and the browser-declared type. Returns null for anything else (images, audio, archives,
 * executables ...). It is a gate against wrong/hostile uploads, not a validity proof: ffprobe in
 * the worker does the real validation.
 */
export function sniffVideoContainer(bytes: Uint8Array): SniffedContainer | null {
  if (bytes.length >= 12 && MP4_FIRST_ATOMS.has(ascii(bytes, 4, 8))) return "mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "matroska";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "AVI ") return "avi";
  if (bytes.length >= 377 && bytes[0] === 0x47 && bytes[188] === 0x47 && bytes[376] === 0x47) return "mpegts";
  if (bytes.length >= 392 && bytes[4] === 0x47 && bytes[196] === 0x47 && bytes[388] === 0x47) return "m2ts";
  return null;
}

export const SNIFF_BYTES = 1024;

export function mimeForContainer(container: SniffedContainer): string {
  switch (container) {
    case "mp4":
      return "video/mp4";
    case "matroska":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    default:
      return "video/mp2t";
  }
}

/** Object key of an original: unguessable-by-name is not the protection (the bucket is private), uniqueness is. */
export function originalObjectKey(videoId: string, now: number, extension: string): string {
  return `originals/${videoId}/${now}.${extension}`;
}
