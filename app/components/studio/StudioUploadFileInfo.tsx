"use client";

import { useLanguage } from "@/app/components/LanguageContext";
import type { StudioLimits } from "./studio-client";
import { formatLimitDuration } from "./video-form";
import { Notice } from "./ui";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

/** Read-only local file/limit hints; the server remains responsible for enforcing limits. */
export default function StudioUploadFileInfo({ file, limits }: { file: File | null; limits?: StudioLimits | null }) {
  const { tx } = useLanguage();
  return (
    <>
      {limits && (
        <p className="text-[13px] text-[var(--chan-muted)]">
          {tx(
            "Limit Twojego kanału: film do {0}, plik do {1}.",
            "Your channel limit: videos up to {0}, files up to {1}.",
            formatLimitDuration(limits.maxVideoSeconds),
            formatBytes(limits.maxUploadBytes),
          )}
        </p>
      )}
      {file && (
        <p className="text-[13px] text-[var(--chan-muted)]">
          {file.name} · {formatBytes(file.size)}
        </p>
      )}
      {file && limits && file.size > limits.maxUploadBytes && (
        <Notice kind="error">
          {tx("Ten plik jest większy niż limit Twojego kanału ({0}).", "This file is larger than your channel limit ({0}).", formatBytes(limits.maxUploadBytes))}
        </Notice>
      )}
    </>
  );
}
