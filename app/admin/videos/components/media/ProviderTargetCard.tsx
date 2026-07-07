"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2, XCircle } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import type { VideoMediaState } from "./types";

type Target = NonNullable<VideoMediaState["activePlan"]>["targets"][number];

export type StepStatus = "done" | "active" | "error" | "pending";

const IN_PROGRESS_STATUSES = new Set(["QUEUED", "STARTING", "WAITING_PROVIDER", "REQUESTED", "RUNNING"]);

function label(provider: string) {
  return provider === "CLOUDFLARE_STREAM" ? "Cloudflare Stream" : provider === "MUX" ? "Mux" : provider;
}

function statusText(status: string) {
  if (status === "READY") return "Gotowe";
  if (IN_PROGRESS_STATUSES.has(status)) return "Tworzę źródło";
  if (status === "FAILED") return "Wymaga interwencji";
  return status;
}

export function targetStepStatus(status: string): StepStatus {
  if (status === "READY") return "done";
  if (status === "FAILED") return "error";
  if (IN_PROGRESS_STATUSES.has(status)) return "active";
  return "pending";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "READY") {
    return <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />{statusText(status)}</Badge>;
  }
  if (status === "FAILED") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{statusText(status)}</Badge>;
  }
  if (IN_PROGRESS_STATUSES.has(status)) {
    return <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100"><Loader2 className="h-3 w-3 animate-spin" />{statusText(status)}</Badge>;
  }
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{statusText(status)}</Badge>;
}

export function ProviderTargetCard({ target }: { target: Target }) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3 shadow-sm transition-colors",
        target.status === "FAILED" && "border-red-200",
        target.status === "READY" && "border-green-200",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label(target.provider)}</span>
        <StatusBadge status={target.status} />
      </div>
      {target.job && (
        <p className="text-xs text-muted-foreground">
          Zadanie: {statusText(target.job.status)} · próba {target.job.attemptCount}/{target.job.maxAttempts}
        </p>
      )}
      {target.lastError && <p className="text-xs text-destructive">{target.lastError}</p>}
    </div>
  );
}
