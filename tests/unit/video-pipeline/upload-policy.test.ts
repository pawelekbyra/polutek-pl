import { describe, expect, it } from "vitest";
import {
  GIB,
  MAX_PARTS,
  MIB,
  isValidPartNumbers,
  maxUploadBytes,
  planParts,
  sniffVideoContainer,
  validateUploadRequest,
} from "@/lib/modules/video-pipeline/domain/upload-policy";

const bytes = (...v: number[]) => Uint8Array.from(v);
const text = (s: string, pad = 0) => Uint8Array.from([...Buffer.from(s, "latin1"), ...new Array(pad).fill(0)]);

describe("validateUploadRequest", () => {
  const ok = { fileName: "Film.MP4", fileSize: 5 * MIB, contentType: "video/mp4" };
  it("accepts a normal video and lowercases the extension", () => {
    const r = validateUploadRequest(ok);
    expect(r).toMatchObject({ ok: true, value: { extension: "mp4" } });
  });
  it("accepts a generic or empty browser type (mkv/ts often have none)", () => {
    expect(validateUploadRequest({ ...ok, fileName: "a.mkv", contentType: "" }).ok).toBe(true);
    expect(validateUploadRequest({ ...ok, contentType: "application/octet-stream" }).ok).toBe(true);
  });
  it("rejects non-video extensions and types", () => {
    for (const fileName of ["a.exe", "a.mp3", "a.png", "a", "a.mp4.php"]) {
      expect(validateUploadRequest({ ...ok, fileName })).toMatchObject({ ok: false, code: "UPLOAD_BAD_TYPE" });
    }
    expect(validateUploadRequest({ ...ok, contentType: "text/html" })).toMatchObject({ ok: false, code: "UPLOAD_BAD_TYPE" });
  });
  it("bounds the size", () => {
    expect(validateUploadRequest({ ...ok, fileSize: 10 })).toMatchObject({ ok: false, code: "UPLOAD_BAD_SIZE" });
    expect(validateUploadRequest({ ...ok, fileSize: 1.5 * MIB })).toMatchObject({ ok: true });
    expect(validateUploadRequest({ ...ok, fileSize: Number.NaN })).toMatchObject({ ok: false });
    expect(validateUploadRequest({ ...ok, fileSize: 11 * GIB })).toMatchObject({ ok: false, code: "UPLOAD_TOO_LARGE" });
    expect(validateUploadRequest({ ...ok, fileSize: 11 * GIB }, 20 * GIB).ok).toBe(true);
  });
  it("reads the size cap from env but never above 50 GiB", () => {
    expect(maxUploadBytes({})).toBe(10 * GIB);
    expect(maxUploadBytes({ VIDEO_UPLOAD_MAX_BYTES: String(2 * GIB) })).toBe(2 * GIB);
    expect(maxUploadBytes({ VIDEO_UPLOAD_MAX_BYTES: String(500 * GIB) })).toBe(50 * GIB);
    expect(maxUploadBytes({ VIDEO_UPLOAD_MAX_BYTES: "abc" })).toBe(10 * GIB);
  });
});

describe("planParts", () => {
  it("uses 16 MiB parts and always stays within R2's limits", () => {
    expect(planParts(20 * MIB)).toEqual({ partSize: 16 * MIB, partCount: 2 });
    expect(planParts(70 * 1024)).toMatchObject({ partCount: 1 });
    const big = planParts(50 * GIB);
    expect(big.partCount).toBeLessThanOrEqual(MAX_PARTS);
    expect(big.partSize * big.partCount).toBeGreaterThanOrEqual(50 * GIB);
    expect(big.partSize % MIB).toBe(0);
  });
  it("validates part number batches", () => {
    expect(isValidPartNumbers([1, 2, 3], 3)).toBe(true);
    expect(isValidPartNumbers([0], 3)).toBe(false);
    expect(isValidPartNumbers([4], 3)).toBe(false);
    expect(isValidPartNumbers([], 3)).toBe(false);
    expect(isValidPartNumbers(Array.from({ length: 51 }, (_, i) => i + 1), 100)).toBe(false);
    expect(isValidPartNumbers([1.5], 3)).toBe(false);
  });
});

describe("sniffVideoContainer (magic bytes)", () => {
  it("recognises MP4/MOV, Matroska/WebM, AVI and MPEG-TS", () => {
    expect(sniffVideoContainer(text("\0\0\0\x20ftypisom\0\0\0\0"))).toBe("mp4");
    expect(sniffVideoContainer(text("\0\0\0\x08wide\0\0\0\0\0\0"))).toBe("mp4");
    expect(sniffVideoContainer(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01))).toBe("matroska");
    expect(sniffVideoContainer(text("RIFF\0\0\0\0AVI LIST"))).toBe("avi");
    const ts = new Uint8Array(400);
    ts[0] = ts[188] = ts[376] = 0x47;
    expect(sniffVideoContainer(ts)).toBe("mpegts");
    const m2ts = new Uint8Array(400);
    m2ts[4] = m2ts[196] = m2ts[388] = 0x47;
    expect(sniffVideoContainer(m2ts)).toBe("m2ts");
  });
  it("rejects everything else, whatever the file name said", () => {
    expect(sniffVideoContainer(text("MZ\x90\0\x03\0\0\0\x04\0\0\0"))).toBeNull(); // Windows executable
    expect(sniffVideoContainer(text("\x89PNG\r\n\x1a\n\0\0\0\rIHDR"))).toBeNull();
    expect(sniffVideoContainer(text("RIFF\0\0\0\0WAVEfmt "))).toBeNull(); // wav audio
    expect(sniffVideoContainer(text("ID3\x04\0\0\0\0\0\0\0\0\0\0"))).toBeNull(); // mp3
    expect(sniffVideoContainer(text("<html><body>"))).toBeNull();
    expect(sniffVideoContainer(new Uint8Array(0))).toBeNull();
    const lone = new Uint8Array(400);
    lone[0] = 0x47; // a single 0x47 is not a TS stream
    expect(sniffVideoContainer(lone)).toBeNull();
  });
});
