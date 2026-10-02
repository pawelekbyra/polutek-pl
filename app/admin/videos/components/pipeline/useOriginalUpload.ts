"use client";

import { useCallback, useRef, useState } from "react";
import { UploadError, cancelUpload, uploadOriginal, type UploadProgress } from "@/lib/video-upload/multipart-uploader";

export type UploadPhase = "idle" | "uploading" | "paused" | "done" | "error";

/** Resumable upload of the original file for one video (see lib/video-upload/multipart-uploader.ts). */
export function useOriginalUpload(videoId: string) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const start = useCallback(
    async (file: File, publishAfterReady: boolean): Promise<boolean> => {
      const ctrl = new AbortController();
      controller.current = ctrl;
      setPhase("uploading");
      setError(null);
      setProgress(null);
      try {
        await uploadOriginal({ videoId, file, publishAfterReady, signal: ctrl.signal, onProgress: setProgress });
        setPhase("done");
        return true;
      } catch (err) {
        if (ctrl.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          setPhase("paused"); // the resume point stays in localStorage
        } else {
          setError(err instanceof UploadError || err instanceof Error ? err.message : "Nie udało się wgrać pliku.");
          setPhase("error");
        }
        return false;
      } finally {
        controller.current = null;
      }
    },
    [videoId],
  );

  /** Stops sending but keeps what R2 already has: picking the same file again resumes. */
  const pause = useCallback(() => controller.current?.abort(), []);

  /** Gives the upload up for good (the server aborts the multipart upload). */
  const cancel = useCallback(
    async (file: File | null) => {
      controller.current?.abort();
      if (file) await cancelUpload(videoId, file);
      setPhase("idle");
      setProgress(null);
    },
    [videoId],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(null);
    setError(null);
  }, []);

  return { phase, progress, error, start, pause, cancel, reset };
}
