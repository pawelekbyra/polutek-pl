import { describe, expect, it, vi } from "vitest";
import { uploadOriginal } from "@/app/components/studio/upload-original";
import { StudioApiError, studioApi } from "@/app/components/studio/studio-client";

type Call = { url: string; method: string; body?: unknown };

/** A fake network: the Studio API answers, and part PUTs return an ETag unless told to fail. */
function network(opts: { partCount?: number; partSize?: number; failPart?: { n: number; times: number; status?: number } } = {}) {
  const partCount = opts.partCount ?? 3;
  const partSize = opts.partSize ?? 10;
  const calls: Call[] = [];
  const failures = new Map<number, number>();
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ url, method, body });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/upload") && method === "POST") return json({ originalId: "o1", partSize, partCount, fileSize: partCount * partSize });
    if (url.endsWith("/upload/parts")) {
      const numbers = (body as { partNumbers: number[] }).partNumbers;
      return json({ urls: numbers.map((n) => ({ partNumber: n, url: `https://r2.example/part/${n}` })), expiresAt: "x" });
    }
    if (url.startsWith("https://r2.example/part/")) {
      const n = Number(url.split("/").pop());
      if (opts.failPart && opts.failPart.n === n) {
        const seen = (failures.get(n) ?? 0) + 1;
        failures.set(n, seen);
        if (seen <= opts.failPart.times) return new Response("", { status: opts.failPart.status ?? 500 });
      }
      return new Response("", { status: 200, headers: { etag: `"etag-${n}"` } });
    }
    if (url.endsWith("/upload/complete")) return json({ originalId: "o1", job: { id: "job-9" } });
    if (url.includes("/upload?originalId=") && method === "DELETE") return json({ ok: true });
    return json({ error: "unexpected", code: "X" }, 500);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const file = (size: number) => new Blob([new Uint8Array(size)], { type: "video/mp4" });
const noWait = async () => undefined;

describe("uploadOriginal", () => {
  it("reserves, presigns, sends every part and completes with the ETags in part order", async () => {
    const net = network({ partCount: 3, partSize: 10 });
    const progress: number[] = [];
    const result = await uploadOriginal({
      videoId: "v1", file: file(25), fileName: "a.mp4", fetchImpl: net.fetchImpl, wait: noWait,
      onProgress: (p) => progress.push(p.uploadedBytes),
    });
    expect(result).toEqual({ originalId: "o1", jobId: "job-9" });
    const complete = net.calls.find((c) => c.url.endsWith("/upload/complete"))!;
    expect(complete.body).toEqual({
      originalId: "o1",
      parts: [{ partNumber: 1, etag: '"etag-1"' }, { partNumber: 2, etag: '"etag-2"' }, { partNumber: 3, etag: '"etag-3"' }],
    });
    // 25 bytes in 3 parts: 10 + 10 + 5; progress ends at the file size and never goes backwards.
    expect(progress[progress.length - 1]).toBe(25);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });

  it("slices the file by the server's part size, the last part being shorter", async () => {
    const net = network({ partCount: 3, partSize: 10 });
    const sizes: number[] = [];
    const original = net.fetchImpl;
    const wrapped = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://r2.example/part/")) sizes.push((init?.body as Blob).size);
      return original(input, init);
    });
    await uploadOriginal({ videoId: "v1", file: file(25), fileName: "a.mp4", fetchImpl: wrapped as unknown as typeof fetch, wait: noWait, concurrency: 1 });
    expect(sizes).toEqual([10, 10, 5]);
  });

  it("retries a failing part and succeeds", async () => {
    const net = network({ failPart: { n: 2, times: 2 } });
    const result = await uploadOriginal({ videoId: "v1", file: file(25), fileName: "a.mp4", fetchImpl: net.fetchImpl, wait: noWait, attempts: 3 });
    expect(result.originalId).toBe("o1");
    expect(net.calls.filter((c) => c.url.endsWith("/part/2")).length).toBe(3);
  });

  it("gives up after the attempts, aborts the reservation and surfaces the failure", async () => {
    const net = network({ failPart: { n: 1, times: 99 } });
    await expect(
      uploadOriginal({ videoId: "v1", file: file(25), fileName: "a.mp4", fetchImpl: net.fetchImpl, wait: noWait, attempts: 2 }),
    ).rejects.toBeInstanceOf(StudioApiError);
    expect(net.calls.some((c) => c.method === "DELETE" && c.url.includes("originalId=o1"))).toBe(true);
    expect(net.calls.some((c) => c.url.endsWith("/upload/complete"))).toBe(false);
  });

  it("does not start when the server refuses the reservation (channel limits)", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Osiągnięto dzienny limit przesyłania (3 filmów). Spróbuj jutro.", code: "UPLOAD_DAILY_LIMIT" }), { status: 429 }),
    );
    await expect(uploadOriginal({ videoId: "v1", file: file(5), fileName: "a.mp4", fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toMatchObject({
      status: 429,
      code: "UPLOAD_DAILY_LIMIT",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("asks for presigned URLs in batches of at most 50 parts", async () => {
    const net = network({ partCount: 120, partSize: 1 });
    await uploadOriginal({ videoId: "v1", file: file(120), fileName: "a.mp4", fetchImpl: net.fetchImpl, wait: noWait });
    const batches = net.calls.filter((c) => c.url.endsWith("/upload/parts")).map((c) => (c.body as { partNumbers: number[] }).partNumbers.length);
    expect(batches).toEqual([50, 50, 20]);
  });
});

describe("studioApi", () => {
  it("returns parsed JSON and sends credentials", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    expect(await studioApi("/api/studio/me", {}, fetchImpl as unknown as typeof fetch)).toEqual({ a: 1 });
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].credentials).toBe("same-origin");
  });

  it("turns an error body into StudioApiError with message and code", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Nie masz dostępu.", code: "FORBIDDEN" }), { status: 403 }));
    await expect(studioApi("/x", {}, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ message: "Nie masz dostępu.", status: 403, code: "FORBIDDEN" });
  });

  it("survives a non-JSON error page", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>502</html>", { status: 502 }));
    await expect(studioApi("/x", {}, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 502 });
  });
});
