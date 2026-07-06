"use client";

import { Badge } from "@/components/ui/badge";
import type { VideoMediaState } from "./types";

type Target = NonNullable<VideoMediaState["activePlan"]>["targets"][number];

function label(provider: string) { return provider === "CLOUDFLARE_STREAM" ? "Cloudflare Stream" : provider === "MUX" ? "Mux" : provider; }
function statusText(status: string) { if (status === "READY") return "Gotowe"; if (["QUEUED", "STARTING", "WAITING_PROVIDER"].includes(status)) return "Tworzę źródło"; if (status === "FAILED") return "Wymaga interwencji"; return status; }

export function ProviderTargetCard({ target }: { target: Target }) {
  return <div className="rounded-lg border bg-card p-3 space-y-2">
    <div className="flex items-center justify-between gap-2"><span className="font-medium">{label(target.provider)}</span><Badge variant={target.status === "READY" ? "default" : target.status === "FAILED" ? "destructive" : "secondary"}>{statusText(target.status)}</Badge></div>
    {target.job && <p className="text-xs text-muted-foreground">Zadanie: {statusText(target.job.status)} · próba {target.job.attemptCount}/{target.job.maxAttempts}</p>}
    {target.lastError && <p className="text-xs text-destructive">{target.lastError}</p>}
  </div>;
}
