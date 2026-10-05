import { describe, expect, it, vi } from "vitest";
import { UploadError, resumeKey, uploadOriginal, type PartPutter } from "@/lib/video-upload/multipart-uploader";

const MIB = 1024 * 1024;
const file = (size: number) => ({ name: "a.mp4", size, lastModified: 1, type: "video/mp4", slice: (a: number, b: number) => ({ size: Math.min(b, size) - a }) }) as unknown as File;

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), map: m };
}

function server(partCount: number, partSize: number, held: Array<{ partNumber: number; etag: string }> = []) {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.replace(/^.*multipart/, "")}`);
    const body = init?.body ? JSON.parse(init.body as string) : null;
    const ok = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
    if (method === "POST" && url.endsWith("/multipart")) return ok({ originalId: "o1", partSize, partCount });
    if (method === "GET") return ok({ parts: held, partSize, partCount });
    if (url.endsWith("/parts")) return ok({ urls: body.partNumbers.map((n: number) => ({ partNumber: n, url: `https://r2/p${n}` })) });
    if (url.endsWith("/complete")) return ok({ originalId: "o1", job: { id: "job1" }, parts: body.parts });
    return ok({}, 404);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls, spy: fetchFn };
}

describe("uploadOriginal", () => {
  it("uploads all parts, reports progress and completes with sorted ETags", async () => {
    const s = server(3, 16 * MIB);
    const store = memoryStorage();
    const put: PartPutter = vi.fn(async (url, _b, o) => { o.onProgress(1); return `"etag-${url.split("/p")[1]}"`; });
    const progress = vi.fn();
    const res = await uploadOriginal({ videoId: "v1", file: file(40 * MIB), signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: put, storage: store, onProgress: progress, concurrency: 2 });
    expect(res).toEqual({ originalId: "o1", jobId: "job1" });
    expect(put).toHaveBeenCalledTimes(3);
    const complete = s.spy.mock.calls.find((c) => String(c[0]).endsWith("/complete"))!;
    expect(JSON.parse(complete[1]!.body as string).parts).toEqual([
      { partNumber: 1, etag: '"etag-1"' }, { partNumber: 2, etag: '"etag-2"' }, { partNumber: 3, etag: '"etag-3"' },
    ]);
    expect(progress.mock.calls.at(-1)![0]).toMatchObject({ uploadedParts: 3, partCount: 3, percent: 100 });
    expect(store.map.size).toBe(0); // resume point cleared after success
  });

  it("sends the last part with its real (smaller) size", async () => {
    const s = server(2, 16 * MIB);
    const sizes: number[] = [];
    await uploadOriginal({ videoId: "v1", file: file(20 * MIB), signal: new AbortController().signal, fetchFn: s.fetchFn, storage: null, putPart: async (_u, b) => { sizes.push((b as Blob).size); return '"e"'; } });
    expect(sizes.sort((a, b) => a - b)).toEqual([4 * MIB, 16 * MIB]);
  });

  it("resumes: skips parts R2 already holds and never restarts", async () => {
    const s = server(3, 16 * MIB, [{ partNumber: 1, etag: '"old1"' }, { partNumber: 2, etag: '"old2"' }]);
    const f = file(40 * MIB);
    const store = memoryStorage({ [resumeKey("v1", f)]: "o1" });
    const put = vi.fn(async () => '"new3"');
    await uploadOriginal({ videoId: "v1", file: f, signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: put, storage: store });
    expect(put).toHaveBeenCalledTimes(1);
    expect(s.calls.some((c) => c.startsWith("POST ") && c.trim() === "POST")).toBe(false); // no new upload was started
    const complete = s.spy.mock.calls.find((c) => String(c[0]).endsWith("/complete"))!;
    expect(JSON.parse(complete[1]!.body as string).parts.map((p: { etag: string }) => p.etag)).toEqual(['"old1"', '"old2"', '"new3"']);
  });

  it("starts over when the remembered upload no longer exists", async () => {
    const s = server(1, 16 * MIB);
    s.spy.mockImplementationOnce(async () => ({ ok: false, status: 409, json: async () => ({ error: "closed", code: "UPLOAD_NOT_OPEN" }) }) as never);
    const f = file(1 * MIB);
    const store = memoryStorage({ [resumeKey("v1", f)]: "dead" });
    const res = await uploadOriginal({ videoId: "v1", file: f, signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: async () => '"e"', storage: store });
    expect(res.originalId).toBe("o1");
  });

  it("retries a failed part with a fresh URL, then gives up after the last attempt", async () => {
    const s = server(1, 16 * MIB);
    let n = 0;
    const flaky: PartPutter = async () => { if (n++ < 2) throw new UploadError("net", "UPLOAD_NETWORK", true); return '"ok"'; };
    const res = await uploadOriginal({ videoId: "v1", file: file(1 * MIB), signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: flaky, storage: null, sleep: async () => undefined });
    expect(res.jobId).toBe("job1");
    expect(s.calls.filter((c) => c.includes("/parts")).length).toBe(3); // initial + one per retry

    const dead = server(1, 16 * MIB);
    await expect(uploadOriginal({ videoId: "v1", file: file(1 * MIB), signal: new AbortController().signal, fetchFn: dead.fetchFn, putPart: async () => { throw new UploadError("net", "UPLOAD_NETWORK", true); }, storage: null, sleep: async () => undefined })).rejects.toThrow("net");
    expect(dead.calls.some((c) => c.includes("/complete"))).toBe(false);
  });

  it("does not retry non-retryable errors and surfaces server errors", async () => {
    const s = server(1, 16 * MIB);
    const put = vi.fn(async () => { throw new UploadError("nope", "UPLOAD_NO_ETAG", false); });
    await expect(uploadOriginal({ videoId: "v1", file: file(1 * MIB), signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: put, storage: null })).rejects.toThrow("nope");
    expect(put).toHaveBeenCalledTimes(1);
    const bad = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ error: "Za duży", code: "UPLOAD_TOO_LARGE" }) }));
    await expect(uploadOriginal({ videoId: "v1", file: file(1 * MIB), signal: new AbortController().signal, fetchFn: bad as never, storage: null })).rejects.toMatchObject({ code: "UPLOAD_TOO_LARGE", message: "Za duży" });
  });

  it("stops on abort and keeps the resume point", async () => {
    const s = server(2, 16 * MIB);
    const ctrl = new AbortController();
    const store = memoryStorage();
    const put: PartPutter = async () => { ctrl.abort(); throw new DOMException("aborted", "AbortError"); };
    await expect(uploadOriginal({ videoId: "v1", file: file(20 * MIB), signal: ctrl.signal, fetchFn: s.fetchFn, putPart: put, storage: store })).rejects.toBeTruthy();
    expect(store.map.size).toBe(1);
    expect(s.calls.some((c) => c.includes("/complete"))).toBe(false);
  });

  it("talks to the admin panel's API when given its base (apps/admin uses /api/videos)", async () => {
    const s = server(1, 16 * MIB);
    const put: PartPutter = vi.fn(async () => '"e1"');
    await uploadOriginal({ videoId: "v 1", file: file(MIB), signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: put, storage: memoryStorage(), apiBase: "/api/videos" });
    const urls = s.spy.mock.calls.map((c) => String(c[0]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith("/api/videos/v%201/original-upload/multipart"))).toBe(true);
  });

  it("defaults to the panel API base and never targets the removed www /api/admin", async () => {
    const s = server(1, 16 * MIB);
    await uploadOriginal({ videoId: "v1", file: file(MIB), signal: new AbortController().signal, fetchFn: s.fetchFn, putPart: vi.fn(async () => '"e1"'), storage: memoryStorage() });
    expect(String(s.spy.mock.calls[0][0])).toBe("/api/videos/v1/original-upload/multipart");
  });
});
