"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VideoSourcesPanel } from "../VideoSourcesPanel";
import type { AdminVideoAssetDto } from "@/lib/modules/video/domain/video.dto";

export function AdvancedVideoSourcesPanel({ videoId, assets, tier, onChanged }: { videoId: string; assets: AdminVideoAssetDto[]; tier: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="rounded-lg border p-3 space-y-3">
    <Button variant="outline" type="button" onClick={() => setOpen((current) => !current)}>{open ? "Ukryj tryb zaawansowany" : "Manualnie / zaawansowane"}</Button>
    {open && <VideoSourcesPanel videoId={videoId} assets={assets} tier={tier} onChanged={() => onChanged?.()} />}
  </div>;
}
