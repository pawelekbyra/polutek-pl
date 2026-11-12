import { UploadError as MultipartUploadError, resumeKey, uploadOriginal as uploadMultipartOriginal, type PartPutter } from "@/lib/video-upload/multipart-uploader";
import { studioFileIdentity } from "@/lib/video-upload/studio-resume";
import { StudioApiError, type StudioFetch } from "./studio-client";

/** Progress shape retained for the Studio wizard while both upload surfaces use one multipart engine. */
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
  publishAfterReady?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  concurrency?: number;
  attempts?: number;
  fetchImpl?: StudioFetch;
  wait?: (ms: number) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

/** Studio adapter for the shared resumable multipart engine. */
export async function uploadOriginal(options: UploadOptions): Promise<{ originalId: string; jobId: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const putPart: PartPutter = async (url, body, { signal }) => {
    const response = await fetchImpl(url, { method: "PUT", body, signal });
    if (!response.ok) {
      const retryable = response.status === 403 || response.status >= 500;
      throw new MultipartUploadError(`Wysyłanie części nie powiodło się (HTTP ${response.status}).`, response.status === 403 ? "UPLOAD_URL_EXPIRED" : `HTTP_${response.status}`, retryable, response.status);
    }
    const etag = response.headers.get("etag");
    if (!etag) throw new MultipartUploadError("Magazyn nie zwrócił znacznika części (ETag).", "UPLOAD_NO_ETAG");
    return etag;
  };
  try {
    const resumeIdentity = await studioFileIdentity(options.file, options.fileName);
    return await uploadMultipartOriginal({
      videoId: options.videoId,
      file: options.file,
      fileName: options.fileName,
      contentType: options.contentType,
      publishAfterReady: options.publishAfterReady,
      resumeIdentity,
      signal: options.signal ?? new AbortController().signal,
      concurrency: options.concurrency,
      attempts: options.attempts,
      fetchFn: options.fetchImpl,
      putPart,
      sleep: options.wait,
      storage: options.storage,
      uploadPath: (videoId) => `/api/studio/videos/${encodeURIComponent(videoId)}/upload`,
      onProgress: (progress) => options.onProgress?.({
        uploadedBytes: progress.uploadedBytes,
        totalBytes: progress.totalBytes,
        completedParts: progress.uploadedParts,
        totalParts: progress.partCount,
      }),
    });
  } catch (error) {
    if (error instanceof MultipartUploadError) {
      const status = error.status ?? (error.code === "API_CONTRACT_MISMATCH" ? 502 : Number(error.code.replace(/^HTTP_/, "")) || 0);
      throw new StudioApiError(error.message, status, error.code);
    }
    throw error;
  }
}

/** Permanently abandons only this file's unfinished Studio reservation after explicit user confirmation. */
export async function cancelStudioUpload(options: Pick<UploadOptions, "videoId" | "file" | "fileName" | "fetchImpl" | "storage">): Promise<void> {
  let storage = options.storage;
  if (storage === undefined) {
    try {
      storage = typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      storage = null;
    }
  }
  const identity = await studioFileIdentity(options.file, options.fileName);
  const key = resumeKey(options.videoId, options.file, options.fileName, identity);
  const originalId = storage?.getItem(key);
  if (!originalId) return;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/studio/videos/${encodeURIComponent(options.videoId)}/upload?originalId=${encodeURIComponent(originalId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: unknown; code?: unknown } | null;
    throw new StudioApiError(
      typeof payload?.error === "string" ? payload.error : `Nie udało się usunąć przesyłania (HTTP ${response.status}).`,
      response.status,
      typeof payload?.code === "string" ? payload.code : undefined,
    );
  }
  storage?.removeItem(key);
}
