import {
  ApiContractError,
  MultipartCompleteResponseSchema,
  MultipartPartsResponseSchema,
  MultipartPresignResponseSchema,
  MultipartStartResponseSchema,
  parseApiContract,
} from "@/lib/video-api-contracts/contracts";
import type { z } from "zod";

/**
 * Browser-side resumable multipart uploader for the own video pipeline.
 * Talks to <apiBase>/[id]/original-upload/multipart{,/parts,/complete} (admin panel apps/admin: /api/videos) and PUTs parts
 * straight to presigned R2 URLs. Framework-free so it can be unit tested with fakes.
 *
 * Resume: the originalId is remembered in localStorage per (video, file name, size, mtime); on the
 * next attempt the server tells which parts R2 already has and only the rest is sent.
 */

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBps: number;
  etaSeconds: number | null;
  uploadedParts: number;
  partCount: number;
}

export type PartPutter = (url: string, body: Blob, opts: { signal: AbortSignal; onProgress: (loaded: number) => void }) => Promise<string>;

export interface UploaderOptions {
  videoId: string;
  file: File | Blob;
  fileName?: string;
  contentType?: string;
  resumeIdentity?: string;
  publishAfterReady?: boolean;
  signal: AbortSignal;
  onProgress?: (p: UploadProgress) => void;
  concurrency?: number;
  attempts?: number;
  fetchFn?: typeof fetch;
  putPart?: PartPutter;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  sleep?: (ms: number) => Promise<void>;
  /** Override the per-video upload route while keeping the multipart protocol shared. */
  uploadPath?: (videoId: string) => string;
  /** Prefix of the video API; defaults to "/api/videos" (the apps/admin panel). */
  apiBase?: string;
}

export const DEFAULT_UPLOAD_API_BASE = "/api/videos";

export class UploadError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

const BATCH = 50;
const MAX_PART_ATTEMPTS = 4;

export function resumeKey(videoId: string, file: File | Blob, fileName?: string, resumeIdentity?: string): string {
  const identity = file as File;
  const name = "name" in file ? file.name : fileName;
  const base = `video-upload:${videoId}:${name ?? "upload"}:${file.size}:${identity.lastModified ?? 0}`;
  return resumeIdentity ? `${base}:${resumeIdentity}` : base;
}

function safeStorage(storage: UploaderOptions["storage"]): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** XHR-based PUT of one part; resolves with the ETag R2 returned (needs ExposeHeaders: ETag in the bucket CORS). */
export const xhrPutPart: PartPutter = (url, body, { signal, onProgress }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort);
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!etag) reject(new UploadError("R2 nie zwrócił ETag (sprawdź CORS bucketa: ExposeHeaders ETag).", "UPLOAD_NO_ETAG"));
        else resolve(etag);
      } else {
        reject(new UploadError(`Część nie została przyjęta (HTTP ${xhr.status}).`, xhr.status === 403 ? "UPLOAD_URL_EXPIRED" : "UPLOAD_PART_FAILED", true));
      }
    };
    xhr.onerror = () => { signal.removeEventListener("abort", onAbort); reject(new UploadError("Błąd sieci podczas wysyłania części.", "UPLOAD_NETWORK", true)); };
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.open("PUT", url);
    xhr.send(body);
  });

async function api<T>(f: typeof fetch, url: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const res = await f(url, init);
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const errorBody = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
    throw new UploadError(
      typeof errorBody?.error === "string" ? errorBody.error : `Błąd serwera (HTTP ${res.status}).`,
      typeof errorBody?.code === "string" ? errorBody.code : `HTTP_${res.status}`,
      res.status >= 500,
      res.status,
    );
  }
  try {
    return parseApiContract(schema, payload, url);
  } catch (error) {
    if (error instanceof ApiContractError) throw new UploadError(error.message, error.code, false);
    throw error;
  }
}

const json = (body: unknown, signal: AbortSignal): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });

/** Uploads the file; resolves when the server has verified it and queued encoding. */
export async function uploadOriginal(opts: UploaderOptions): Promise<{ originalId: string; jobId: string }> {
  const f = opts.fetchFn ?? fetch.bind(globalThis);
  const putPart = opts.putPart ?? xhrPutPart;
  const store = safeStorage(opts.storage);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = Math.max(1, opts.attempts ?? MAX_PART_ATTEMPTS);
  const base = opts.uploadPath?.(opts.videoId) ?? `${opts.apiBase ?? DEFAULT_UPLOAD_API_BASE}/${encodeURIComponent(opts.videoId)}/original-upload/multipart`;
  const key = resumeKey(opts.videoId, opts.file, opts.fileName, opts.resumeIdentity);
  const { file, signal } = opts;

  let originalId: string | null = null;
  let partSize = 0;
  let partCount = 0;
  const etags = new Map<number, string>();

  const saved = store?.getItem(key) ?? null;
  if (saved) {
    try {
      const listed = await api(f, `${base}?originalId=${encodeURIComponent(saved)}`, { signal }, MultipartPartsResponseSchema);
      if (listed.partSize * (listed.partCount - 1) < file.size && listed.partSize * listed.partCount >= file.size) {
        originalId = saved;
        partSize = listed.partSize;
        partCount = listed.partCount;
        for (const p of listed.parts) etags.set(p.partNumber, p.etag);
      }
    } catch (error) {
      if (signal.aborted) throw error;
      if (!(error instanceof UploadError) || !["ORIGINAL_NOT_FOUND", "UPLOAD_NOT_OPEN"].includes(error.code)) throw error;
      store?.removeItem(key); // the old upload is gone (409/404): start over
    }
  }
  if (!originalId) {
    const fileName = opts.fileName ?? ("name" in file ? file.name : "video");
    const contentType = opts.contentType ?? (("type" in file ? file.type : "") || "application/octet-stream");
    const started = await api(f, base, json({ fileName, fileSize: file.size, contentType }, signal), MultipartStartResponseSchema);
    originalId = started.originalId;
    partSize = started.partSize;
    partCount = started.partCount;
    store?.setItem(key, originalId);
  }
  const id = originalId;

  const sizeOf = (n: number) => (n === partCount ? file.size - partSize * (partCount - 1) : partSize);
  const inFlight = new Map<number, number>(); // partNumber -> bytes sent so far
  const startedAt = Date.now();
  const samples: Array<{ t: number; bytes: number }> = [];
  const doneBytes = () => [...etags.keys()].reduce((a, n) => a + sizeOf(n), 0);

  const report = () => {
    const uploaded = doneBytes() + [...inFlight.values()].reduce((a, b) => a + b, 0);
    const now = Date.now();
    samples.push({ t: now, bytes: uploaded });
    while (samples.length > 2 && now - samples[0].t > 10_000) samples.shift();
    const first = samples[0];
    const dt = (now - first.t) / 1000;
    const speed = dt > 0.5 ? Math.max(0, (uploaded - first.bytes) / dt) : (uploaded / Math.max(1, (now - startedAt) / 1000));
    opts.onProgress?.({
      uploadedBytes: uploaded,
      totalBytes: file.size,
      percent: Math.min(100, (uploaded / file.size) * 100),
      speedBps: speed,
      etaSeconds: speed > 1024 ? Math.round((file.size - uploaded) / speed) : null,
      uploadedParts: etags.size,
      partCount,
    });
  };
  report();

  const pending = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !etags.has(n));
  const urls = new Map<number, string>();
  const presign = async (numbers: number[]) => {
    const res = await api(f, `${base}/parts`, json({ originalId: id, partNumbers: numbers }, signal), MultipartPresignResponseSchema);
    for (const u of res.urls) urls.set(u.partNumber, u.url);
  };

  // Presign lazily in batches of 50 so URLs stay fresh on very long uploads.
  let cursor = 0;
  let presignTail: Promise<void> = Promise.resolve();
  const ensureUrl = async (n: number) => {
    if (urls.has(n)) return;
    presignTail = presignTail.then(async () => {
      if (urls.has(n)) return;
      const from = pending.indexOf(n);
      await presign(pending.slice(from, from + BATCH).filter((x) => !urls.has(x) && !etags.has(x)));
    });
    await presignTail;
  };

  const sendPart = async (n: number) => {
    const blob = file.slice((n - 1) * partSize, (n - 1) * partSize + sizeOf(n));
    for (let attempt = 1; ; attempt++) {
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      try {
        await ensureUrl(n);
        const etag = await putPart(urls.get(n)!, blob, { signal, onProgress: (loaded) => { inFlight.set(n, loaded); report(); } });
        inFlight.delete(n);
        etags.set(n, etag);
        report();
        return;
      } catch (error) {
        inFlight.delete(n);
        if (signal.aborted || (error as { name?: string }).name === "AbortError") throw error;
        const retryable = error instanceof UploadError ? error.retryable : true;
        if (!retryable || attempt >= maxAttempts) throw error;
        urls.delete(n); // a fresh URL also covers an expired one
        await sleep(500 * 2 ** (attempt - 1));
      }
    }
  };

  let failure: unknown = null;
  const workers = Array.from({ length: Math.min(opts.concurrency ?? 4, pending.length) }, async () => {
    while (!failure) {
      const n = pending[cursor++];
      if (n === undefined) return;
      try {
        await sendPart(n);
      } catch (error) {
        failure = failure ?? error;
        return;
      }
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;

  const parts = [...etags.entries()].sort((a, b) => a[0] - b[0]).map(([partNumber, etag]) => ({ partNumber, etag }));
  const done = await api(f, `${base}/complete`, json({ originalId: id, parts, ...(opts.publishAfterReady !== undefined ? { publishAfterReady: opts.publishAfterReady } : {}) }, signal), MultipartCompleteResponseSchema);
  store?.removeItem(key);
  return { originalId: done.originalId, jobId: done.job.id };
}

/** Cancels the upload for good (server aborts the multipart upload) and forgets the resume point. */
export async function cancelUpload(videoId: string, file: File, fetchFn: typeof fetch = fetch.bind(globalThis), storage?: UploaderOptions["storage"], apiBase: string = DEFAULT_UPLOAD_API_BASE, uploadPath?: (videoId: string) => string): Promise<void> {
  const store = safeStorage(storage);
  const key = resumeKey(videoId, file);
  const originalId = store?.getItem(key);
  store?.removeItem(key);
  if (!originalId) return;
  const base = uploadPath?.(videoId) ?? `${apiBase}/${encodeURIComponent(videoId)}/original-upload/multipart`;
  await fetchFn(`${base}?originalId=${encodeURIComponent(originalId)}`, { method: "DELETE" }).catch(() => undefined);
}
