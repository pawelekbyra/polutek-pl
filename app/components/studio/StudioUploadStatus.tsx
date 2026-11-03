"use client";

import { useLanguage } from "@/app/components/LanguageContext";
import type { UploadProgress } from "./upload-original";
import { Notice, ProgressBar, buttonClass, ghostButtonClass } from "./ui";

export type UploadPhase = "idle" | "creating" | "uploading" | "error";

interface UploadStatusProps {
  title: string;
  visibilityLabel: string;
  phase: UploadPhase;
  progress: UploadProgress | null;
  warning: string | null;
  error: string | null;
  draftId: string | null;
  onRetry: () => void;
  onCancel: () => void;
  onOpenDraft: () => void;
}

/** Presentation of a running upload; the wizard owns requests, cancellation and draft reuse. */
export default function StudioUploadStatus({ title, visibilityLabel, phase, progress, warning, error, draftId, onRetry, onCancel, onOpenDraft }: UploadStatusProps) {
  const { tx } = useLanguage();
  const sending = phase === "creating" || phase === "uploading";
  const percent = progress && progress.totalBytes > 0 ? (progress.uploadedBytes / progress.totalBytes) * 100 : 0;
  return (
    <div className="grid max-w-2xl gap-4">
      <dl className="grid gap-1 text-[14px]">
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold text-[var(--chan-ink)]">{tx("Tytuł", "Title")}:</dt>
          <dd className="text-[var(--chan-muted)]">{title.trim()}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold text-[var(--chan-ink)]">{tx("Widoczność", "Visibility")}:</dt>
          <dd className="text-[var(--chan-muted)]">{visibilityLabel}</dd>
        </div>
      </dl>
      <div className="grid gap-2" aria-live="polite">
        <ProgressBar value={percent} />
        <p className="text-[13px] text-[var(--chan-muted)]">
          {phase === "creating" && tx("Tworzę prywatny szkic…", "Creating a private draft…")}
          {phase === "uploading" && tx("Przesłano {0}%", "Uploaded {0}%", Math.round(percent))}
          {phase === "error" && tx("Przesyłanie zatrzymane.", "Upload stopped.")}
        </p>
      </div>
      {sending && (
        <p className="text-[12px] text-[var(--chan-muted)]">
          {tx(
            "Nie zamykaj tej karty. Jeśli przerwiesz, film zostanie prywatnym szkicem.",
            "Keep this tab open. If you stop, the video stays a private draft.",
          )}
        </p>
      )}
      {warning && <Notice>{warning}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {phase === "error" && (
          <button type="button" className={buttonClass} onClick={onRetry}>
            {tx("Spróbuj ponownie", "Try again")}
          </button>
        )}
        {phase === "error" && draftId && (
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onOpenDraft}
          >
            {tx("Przejdź do szkicu", "Go to the draft")}
          </button>
        )}
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          {sending ? tx("Przerwij", "Cancel") : tx("Wróć do filmów", "Back to videos")}
        </button>
      </div>
    </div>
  );
}
