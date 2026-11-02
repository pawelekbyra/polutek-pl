"use client";

import { useLanguage } from "@/app/components/LanguageContext";
import { studioThumbnailSrc, type StudioVideo } from "./studio-client";
import type { PipelineView } from "./StudioVideoEditor";
import { Badge, Card, Notice, ProgressBar, inputClass, smallGhostButtonClass } from "./ui";

interface VideoPreviewProps {
  video: StudioVideo;
  pipeline: PipelineView | null;
  busy: boolean;
  watchUrl: string;
  copied: boolean;
  onCopyLink: () => void;
  onCancelAutoPublish: () => void;
}

/** Status, pipeline and share link; the editor owns the data and every action. */
export default function StudioVideoPreview({ video, pipeline, busy, watchUrl, copied, onCopyLink, onCancelAutoPublish }: VideoPreviewProps) {
  const { tx, language } = useLanguage();
  const pipelineLabel: Record<PipelineView["summary"], string> = {
    NO_ORIGINAL: tx("Brak pliku", "No file"),
    UPLOADING: tx("Przesyłanie", "Uploading"),
    QUEUED: tx("W kolejce do przetwarzania", "Waiting to be processed"),
    ENCODING: tx("Przetwarzanie", "Processing"),
    READY: tx("Gotowy do publikacji", "Ready to publish"),
    FAILED: tx("Przetwarzanie nie powiodło się", "Processing failed"),
    CANCELLED: tx("Anulowano", "Cancelled"),
    UPLOAD_FAILED: tx("Przesyłanie nie powiodło się", "Upload failed"),
  };
  const statusLabel: Record<StudioVideo["status"], string> = {
    DRAFT: tx("Szkic", "Draft"),
    PUBLISHED: tx("Opublikowany", "Published"),
    UNLISTED: tx("Niepubliczny", "Unlisted"),
    ARCHIVED: tx("Zarchiwizowany", "Archived"),
  };
  const published = video.status === "PUBLISHED";
  const unlisted = video.status === "UNLISTED";
  const linkLive = published || unlisted;
  const premiereDate = video.premiereAt ? new Date(video.premiereAt) : null;
  const premiereUpcoming = premiereDate !== null && premiereDate.getTime() > Date.now();

  return (
    <aside aria-label={tx("Podgląd filmu", "Video preview")} className="grid gap-4 lg:sticky lg:top-4">
      <Card>
        {/* The DTO's thumbnailUrl is already a public src (proxy path or public bucket URL). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={studioThumbnailSrc(video)}
          alt={tx("Miniatura filmu", "Video thumbnail")}
          className="aspect-video w-full rounded-xl bg-[var(--chan-surface)] object-cover"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={published ? "good" : "neutral"}>{statusLabel[video.status]}</Badge>
          {video.isAdult && <Badge tone="warn">18+</Badge>}
          <span className="text-[13px] text-[var(--chan-ink)]">{pipeline ? pipelineLabel[pipeline.summary] : tx("Sprawdzam…", "Checking…")}</span>
        </div>
        {pipeline?.job && pipeline.summary === "ENCODING" && (
          <div className="mt-3">
            <ProgressBar value={pipeline.job.progressPercent} />
          </div>
        )}
        {(pipeline?.summary === "FAILED" || pipeline?.summary === "UPLOAD_FAILED") && (
          <div className="mt-3">
            <Notice kind="error">
              {pipeline.job?.failureReason ?? pipeline.original?.failureReason ?? tx("Spróbuj przesłać plik ponownie.", "Try uploading the file again.")}
            </Notice>
          </div>
        )}
        {video.publishAfterAssetReady && video.status === "DRAFT" && (
          <div className="mt-3 grid gap-2">
            <p className="text-[13px] text-[var(--chan-muted)]">
              {tx("Ten film opublikuje się sam, gdy skończy się przetwarzanie.", "This video publishes itself when processing finishes.")}
            </p>
            <div>
              <button
                type="button"
                className={smallGhostButtonClass}
                disabled={busy}
                onClick={onCancelAutoPublish}
              >
                {tx("Anuluj automatyczną publikację", "Cancel automatic publication")}
              </button>
            </div>
          </div>
        )}
        {premiereDate && premiereUpcoming && (
          <p className="mt-3 text-[13px] text-[var(--chan-muted)]">
            {tx("Premiera: {0}", "Premiere: {0}", premiereDate.toLocaleString(language))}
          </p>
        )}
        <p className="mt-3 text-[13px] text-[var(--chan-muted)]">{tx("{0} wyświetleń", "{0} views", video.views)}</p>
      </Card>

      <Card title={tx("Link do filmu", "Video link")}>
        {linkLive && watchUrl ? (
          <div className="grid gap-2">
            {unlisted && (
              <p className="text-[12px] text-[var(--chan-muted)]">
                {tx("Ten film jest niepubliczny: obejrzy go każdy, kto dostanie ten link.", "This video is unlisted: anyone who gets this link can watch it.")}
              </p>
            )}
            <input readOnly value={watchUrl} aria-label={tx("Link do filmu", "Video link")} className={inputClass} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={smallGhostButtonClass} onClick={onCopyLink}>
                {tx("Kopiuj", "Copy")}
              </button>
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center rounded-lg px-2 text-[13px] font-semibold text-[var(--chan-ink)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]"
              >
                {tx("Otwórz film", "Open video")}
              </a>
              <span role="status" className="text-[12px] text-[var(--chan-muted)]">
                {copied ? tx("Skopiowano.", "Copied.") : ""}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--chan-muted)]">{tx("Link pojawi się po opublikowaniu filmu.", "The link appears once the video is published.")}</p>
        )}
      </Card>
    </aside>
  );
}
