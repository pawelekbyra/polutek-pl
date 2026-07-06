"use client";

import { Badge } from "@/components/ui/badge";
import { ProviderTargetCard } from "./ProviderTargetCard";
import { ActivePlaybackRouteCard } from "./ActivePlaybackRouteCard";
import type { VideoMediaState } from "./types";

export function VideoPipelineTimeline({ mediaState }: { mediaState: VideoMediaState | null }) {
  if (!mediaState) return <div className="rounded-lg border p-4 text-sm text-muted-foreground">Ładuję stan mediów…</div>;
  return <div className="space-y-3">
    <div className="flex items-center justify-between rounded-lg border bg-card p-3"><span className="font-medium">Oryginał</span><Badge variant={mediaState.original?.status === "READY" ? "default" : "outline"}>{mediaState.original ? "Oryginał zapisany" : "Brak"}</Badge></div>
    {mediaState.activePlan?.targets.map((target) => <ProviderTargetCard key={target.id} target={target} />)}
    <ActivePlaybackRouteCard route={mediaState.activeRoute} />
    {mediaState.summary.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{mediaState.summary.warnings.join(" ")}</div>}
  </div>;
}
