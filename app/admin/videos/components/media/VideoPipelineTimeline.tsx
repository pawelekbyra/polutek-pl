"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { ProviderTargetCard, targetStepStatus, type StepStatus } from "./ProviderTargetCard";
import { ActivePlaybackRouteCard } from "./ActivePlaybackRouteCard";
import type { VideoMediaState } from "./types";
import type { AdminVideoMediaSummaryState } from "@/lib/modules/video/application/video-media-state.dto";

const STATE_META: Record<AdminVideoMediaSummaryState, { label: string; className: string }> = {
  NO_ORIGINAL: { label: "Brak oryginału", className: "bg-muted text-muted-foreground" },
  WAITING_UPLOAD: { label: "Oczekuje na upload", className: "bg-slate-100 text-slate-700" },
  ORIGINAL_READY: { label: "Oryginał gotowy", className: "bg-slate-100 text-slate-700" },
  CREATING_SOURCES: { label: "Tworzę źródła", className: "bg-amber-100 text-amber-800" },
  PARTIALLY_READY: { label: "Częściowo gotowe", className: "bg-amber-100 text-amber-800" },
  READY: { label: "Gotowe", className: "bg-green-100 text-green-800" },
  LEGACY_FALLBACK: { label: "Legacy fallback", className: "bg-amber-100 text-amber-900" },
  FAILED: { label: "Błąd", className: "bg-red-100 text-red-800" },
  MANUAL_ACTION_REQUIRED: { label: "Wymaga działania", className: "bg-amber-100 text-amber-800" },
};

function StepMarker({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 ring-4 ring-green-50">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 ring-4 ring-red-50">
        <XCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-4 ring-amber-50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/25 bg-muted" />
  );
}

function PipelineStep({ status, isLast, children }: { status: StepStatus; isLast?: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepMarker status={status} />
        {!isLast && <div className={cn("mt-1 w-px flex-1", status === "done" ? "bg-green-200" : "bg-border")} />}
      </div>
      <div className="flex-1 pb-4 last:pb-0">{children}</div>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ładuję stan mediów…
      </div>
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function VideoPipelineTimeline({ mediaState }: { mediaState: VideoMediaState | null }) {
  if (!mediaState) return <PipelineSkeleton />;

  const originalStatus: StepStatus = mediaState.original?.status === "READY" ? "done" : mediaState.original ? "active" : "pending";
  const targets = mediaState.activePlan?.targets ?? [];
  const routeStatus: StepStatus = mediaState.activeRoute ? "done" : "pending";
  const meta = STATE_META[mediaState.summary.state];
  const isLegacyFallback = mediaState.summary.state === "LEGACY_FALLBACK";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="text-sm font-medium">Status pipeline&rsquo;u</span>
        <Badge className={cn("gap-1", meta.className)}>{meta.label}</Badge>
      </div>

      {isLegacyFallback && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Film odtwarza się wyłącznie przez starą ścieżkę zapasową (legacy primary asset), bez aktywnej trasy odtwarzania.
            Publikacja jest zablokowana — aktywuj prawdziwe źródło, żeby to naprawić.
          </span>
        </div>
      )}

      <div>
        <PipelineStep status={originalStatus} isLast={targets.length === 0 && !mediaState.activeRoute}>
          <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
            <span className="font-medium">Oryginał</span>
            <Badge
              className={cn("gap-1", originalStatus === "done" ? "bg-green-100 text-green-800 hover:bg-green-100" : undefined)}
              variant={originalStatus === "done" ? "default" : "outline"}
            >
              {mediaState.original ? "Oryginał zapisany" : "Brak"}
            </Badge>
          </div>
        </PipelineStep>

        {targets.map((target, index) => (
          <PipelineStep key={target.id} status={targetStepStatus(target.status)} isLast={index === targets.length - 1 && !mediaState.activeRoute}>
            <ProviderTargetCard target={target} />
          </PipelineStep>
        ))}

        <PipelineStep status={routeStatus} isLast>
          <ActivePlaybackRouteCard route={mediaState.activeRoute} />
        </PipelineStep>
      </div>

      {mediaState.summary.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{mediaState.summary.warnings.join(" ")}</div>
      )}
    </div>
  );
}
