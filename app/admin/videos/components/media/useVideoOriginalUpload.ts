"use client";

import { useCallback, useRef, useState } from "react";
import type { VideoDistributionStrategy, VideoMediaState } from "./types";

function readError(payload: unknown): string | null {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string" ? (payload as { error: string }).error : null;
}

export function useVideoOriginalUpload(videoId: string) {
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => { setProgress(0); setError(null); }, []);
  const cancel = useCallback(() => { abortRef.current?.abort(); abortRef.current = null; setUploading(false); }, []);

  const upload = useCallback(async (input: { file: File; strategy: VideoDistributionStrategy; publishAfterReady: boolean }): Promise<VideoMediaState> => {
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const provisionResponse = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: input.file.name, fileSize: input.file.size, contentType: input.file.type || "video/mp4" }),
        signal: controller.signal,
      });
      const provisionPayload = await provisionResponse.json().catch((): unknown => null);
      if (!provisionResponse.ok) throw new Error(readError(provisionPayload) ?? "Nie udało się przygotować uploadu.");
      const provision = provisionPayload as { uploadUrl: string; originalId: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        controller.signal.addEventListener("abort", () => { xhr.abort(); reject(new DOMException("Upload cancelled", "AbortError")); });
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 90)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload do R2 nieudany (HTTP ${xhr.status}).`));
        xhr.onerror = () => reject(new Error("Upload do R2 nieudany."));
        xhr.open("PUT", provision.uploadUrl);
        xhr.setRequestHeader("Content-Type", input.file.type || "video/mp4");
        xhr.send(input.file);
      });

      setProgress(95);
      const completeResponse = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalId: provision.originalId, strategy: input.strategy, publishAfterReady: input.publishAfterReady }),
        signal: controller.signal,
      });
      const completePayload = await completeResponse.json().catch((): unknown => null);
      if (!completeResponse.ok) throw new Error(readError(completePayload) ?? "Nie udało się zakończyć uploadu.");
      setProgress(100);
      return completePayload as VideoMediaState;
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError" ? "Upload anulowany." : err instanceof Error ? err.message : "Nieznany błąd.";
      setError(message);
      throw err;
    } finally {
      abortRef.current = null;
      setUploading(false);
    }
  }, [videoId]);

  return { upload, cancel, reset, retry: upload, uploading, progress, error };
}
