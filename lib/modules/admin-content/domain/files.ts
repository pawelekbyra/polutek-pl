/**
 * Content checks of files the admin uploads in the panel. The browser's MIME type is never trusted:
 * images are recognised by their magic bytes, subtitles must be real WebVTT. Pure functions.
 */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const SUBTITLE_MAX_BYTES = 1024 * 1024;

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

export function detectImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return { mime: "image/png", extension: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

export type VttCheck = { ok: true; text: string; cues: number } | { ok: false; reason: string };

const TIMING = /^(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}(?:\s.*)?$/;

/**
 * A WebVTT file as browsers accept it: UTF-8, first line "WEBVTT" (optional BOM and header text), at least
 * one cue with a valid "hh:mm:ss.mmm --> hh:mm:ss.mmm" timing line, no script-like content. Returns the
 * normalised text (BOM removed, LF line ends) that gets stored.
 */
export function validateVtt(bytes: Uint8Array): VttCheck {
  if (bytes.length === 0) return { ok: false, reason: "Plik jest pusty." };
  if (bytes.length > SUBTITLE_MAX_BYTES) return { ok: false, reason: "Plik napisów może mieć najwyżej 1 MB." };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: "Plik nie jest w UTF-8. Zapisz napisy jako UTF-8." };
  }
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0] ?? "")) {
    return { ok: false, reason: "To nie jest WebVTT: pierwsza linia musi brzmieć „WEBVTT” (plik SRT trzeba przekonwertować)." };
  }
  const cues = lines.filter((l) => TIMING.test(l.trim())).length;
  if (cues === 0) return { ok: false, reason: "Brak napisów z poprawnym czasem (00:00:01.000 --> 00:00:03.000)." };
  if (/<\s*script|javascript:/i.test(text)) return { ok: false, reason: "Plik zawiera niedozwolone znaczniki." };
  return { ok: true, text: text.endsWith("\n") ? text : `${text}\n`, cues };
}

/** "Moja premiera!" -> "moja-premiera" (Polish letters folded), max 80 chars. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
