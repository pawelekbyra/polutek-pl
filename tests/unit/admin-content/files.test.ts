import { describe, expect, it } from "vitest";
import { COVER_MAX_BYTES, SUBTITLE_MAX_BYTES, detectImage, slugify, thumbnailState, validateVtt } from "@/lib/modules/admin-content";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

describe("detectImage (magic bytes, never the browser's MIME type)", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(detectImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(detectImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.extension).toBe("png");
    expect(detectImage(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))?.mime).toBe("image/webp");
  });

  it("refuses everything else, including a renamed SVG or HTML and truncated headers", () => {
    expect(detectImage(text("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImage(text("<!doctype html>"))).toBeNull();
    expect(detectImage(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImage(text("RIFF0000WAVE"))).toBeNull();
    expect(detectImage(bytes())).toBeNull();
  });

  it("limits are the documented ones", () => {
    expect(COVER_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(SUBTITLE_MAX_BYTES).toBe(1024 * 1024);
  });
});

describe("validateVtt", () => {
  const good = "WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nCześć!\n\n01:02.000 --> 01:04.000 align:start\nDrugi\n";

  it("accepts real WebVTT and counts cues", () => {
    const r = validateVtt(text(good));
    expect(r).toEqual({ ok: true, text: good, cues: 2 });
  });

  it("strips a BOM, normalises CRLF and adds the final newline", () => {
    const r = validateVtt(text(`﻿WEBVTT header\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nx`));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("WEBVTT header\n\n00:00:01.000 --> 00:00:02.000\nx\n");
  });

  it("refuses SRT, empty files, files without cues, non UTF-8 and script content", () => {
    expect(validateVtt(text("1\n00:00:01,000 --> 00:00:02,000\nx")).ok).toBe(false);
    expect(validateVtt(bytes()).ok).toBe(false);
    expect(validateVtt(text("WEBVTT\n\nNOTE nic\n")).ok).toBe(false);
    expect(validateVtt(bytes(0x57, 0x45, 0x42, 0x56, 0x54, 0x54, 0x0a, 0xff, 0xfe)).ok).toBe(false);
    expect(validateVtt(text("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<script>alert(1)</script>\n")).ok).toBe(false);
    expect(validateVtt(text("WEBVTTX\n\n00:00:01.000 --> 00:00:02.000\nx")).ok).toBe(false);
  });

  it("refuses a file over 1 MB", () => {
    const big = new Uint8Array(SUBTITLE_MAX_BYTES + 1).fill(0x41);
    const r = validateVtt(big);
    expect(r.ok).toBe(false);
  });
});

describe("slugify", () => {
  it("folds Polish letters and punctuation", () => {
    expect(slugify("Zażółć gęślą jaźń!")).toBe("zazolc-gesla-jazn");
    expect(slugify("  Łódź -- 2026 / premiera  ")).toBe("lodz-2026-premiera");
  });

  it("is at most 80 characters and never ends with a dash", () => {
    const s = slugify(`${"a".repeat(79)} b`);
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("thumbnailState", () => {
  const env = { CLOUDFLARE_R2_ACCOUNT_ID: "acc", CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: "priv", CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC: "pub", NEXT_PUBLIC_R2_PUBLIC_HOST: "thumbs.example.com" };
  const priv = "https://acc.r2.cloudflarestorage.com/priv/videos/v1/covers/abc.jpg";

  it("names the default cover", () => {
    expect(thumbnailState({ status: "PUBLISHED", thumbnailUrl: null, thumbnailPublicUrl: null }, env).label).toBe("Domyślna");
    expect(thumbnailState({ status: "DRAFT", thumbnailUrl: "/logo.png", thumbnailPublicUrl: null }, env).label).toBe("Domyślna");
  });

  it("knows an old Blob cover", () => {
    expect(thumbnailState({ status: "PUBLISHED", thumbnailUrl: "https://x.public.blob.vercel-storage.com/a.jpg", thumbnailPublicUrl: null }, env).kind).toBe("info");
  });

  it("checks the public copy of a published film", () => {
    expect(thumbnailState({ status: "PUBLISHED", thumbnailUrl: priv, thumbnailPublicUrl: "https://thumbs.example.com/videos/v1/covers/abc.jpg" }, env)).toMatchObject({ kind: "ok" });
    expect(thumbnailState({ status: "PUBLISHED", thumbnailUrl: priv, thumbnailPublicUrl: null }, env)).toMatchObject({ kind: "warn", label: "Niezsynchr." });
    expect(thumbnailState({ status: "DRAFT", thumbnailUrl: priv, thumbnailPublicUrl: null }, env)).toMatchObject({ kind: "ok" });
  });
});
