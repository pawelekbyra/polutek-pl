import { StudioApiError, jsonBody, studioApi, type StudioFetch } from "./studio-client";

/**
 * Sends the original file of a video straight to private storage in parts (CLAUDE.md 4.17): the server only
 * reserves the upload, hands out presigned part addresses and verifies the finished object. Each part is retried;
 * progress is reported in bytes. The same flow as the admin panel, through `/api/studio/videos/:id/upload`.
 */

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  completedParts: number;
  totalParts: number;
}

export interface UploadOptions {
  videoId: string;
  file: File | Blob;
  fileName: string;
  contentType?: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  /** Parts sent at once (default 4). */
  concurrency?: number;
  /** Tries per part before the upload fails (default 3). */
  attempts?: number;
  fetchImpl?: StudioFetch;
  /** Delay between tries, replaceable in tests. */
  wait?: (ms: number) => Promise<void>;
}

interface StartedUpload {
  originalId: string;
  partSize: number;
  partCount: number;
  fileSize: number;
}

const PRESIGN_BATCH = 50;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function uploadOriginal(options: UploadOptions): Promise<{ originalId: string; jobId: string | null }> {
  const { videoId, file, fileName, onProgress, signal } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const attempts = Math.max(1, options.attempts ?? 3);
  const wait = options.wait ?? sleep;
  const base = `/api/studio/videos/${encodeURIComponent(videoId)}/upload`;

  const started = await studioApi<StartedUpload>(
    base,
    { method: "POST", ...jsonBody({ fileName, fileSize: file.size, contentType: options.contentType || file.type || undefined }), signal },
    fetchImpl,
  );

  const totalParts = started.partCount;
  const partBytes = (n: number) => Math.min(started.partSize, file.size - (n - 1) * started.partSize);
  const done = new Map<number, string>();
  let uploadedBytes = 0;
  const report = () => onProgress?.({ uploadedBytes, totalBytes: file.size, completedParts: done.size, totalParts });
  report();

  const abort = () => studioApi(`${base}?originalId=${encodeURIComponent(started.originalId)}`, { method: "DELETE" }, fetchImpl).catch(() => undefined);

  try {
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
    for (let i = 0; i < partNumbers.length; i += PRESIGN_BATCH) {
      const batch = partNumbers.slice(i, i + PRESIGN_BATCH);
      const { urls } = await studioApi<{ urls: Array<{ partNumber: number; url: string }> }>(
        `${base}/parts`,
        { method: "POST", ...jsonBody({ originalId: started.originalId, partNumbers: batch }), signal },
        fetchImpl,
      );

      const queue = [...urls];
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          if (signal?.aborted) throw new StudioApiError("Przesyłanie zostało przerwane.", 499, "ABORTED");
          const start = (item.partNumber - 1) * started.partSize;
          const body = file.slice(start, start + partBytes(item.partNumber));
          const etag = await putPart(item.url, body, attempts, wait, fetchImpl, signal);
          done.set(item.partNumber, etag);
          uploadedBytes += partBytes(item.partNumber);
          report();
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    }

    const parts = [...done.entries()].sort((a, b) => a[0] - b[0]).map(([partNumber, etag]) => ({ partNumber, etag }));
    const completed = await studioApi<{ originalId: string; job?: { id?: string } | null }>(
      `${base}/complete`,
      { method: "POST", ...jsonBody({ originalId: started.originalId, parts }), signal },
      fetchImpl,
    );
    return { originalId: started.originalId, jobId: completed.job?.id ?? null };
  } catch (error) {
    await abort();
    throw error;
  }
}

async function putPart(
  url: string,
  body: Blob,
  attempts: number,
  wait: (ms: number) => Promise<void>,
  fetchImpl: StudioFetch,
  signal?: AbortSignal,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { method: "PUT", body, signal });
      if (!response.ok) throw new StudioApiError(`Wysyłanie części nie powiodło się (${response.status}).`, response.status, "PART_FAILED");
      const etag = response.headers.get("etag");
      if (!etag) throw new StudioApiError("Magazyn nie zwrócił znacznika części (ETag).", 502, "PART_ETAG_MISSING");
      // Returned exactly as the storage sent it (quotes included): that is what CompleteMultipartUpload expects.
      return etag;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) break;
      if (attempt < attempts) await wait(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new StudioApiError("Wysyłanie nie powiodło się.", 502, "PART_FAILED");
}
