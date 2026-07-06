"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import type { AdminVideoAssetDto } from "@/lib/modules/video/domain/video.dto";
import { AdvancedVideoSourcesPanel } from "./AdvancedVideoSourcesPanel";
import { strategyFromChoice, VideoDistributionStrategySelect } from "./VideoDistributionStrategySelect";
import { VideoPipelineTimeline } from "./VideoPipelineTimeline";
import { VideoUploadDropzone } from "./VideoUploadDropzone";
import { useVideoMediaState } from "./useVideoMediaState";
import { useVideoOriginalUpload } from "./useVideoOriginalUpload";
import type { StrategyChoice } from "./types";

export function VideoMediaManager({ videoId, assets, tier, onChanged }: { videoId: string; assets: AdminVideoAssetDto[]; tier: string; onChanged?: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [strategyChoice, setStrategyChoice] = useState<StrategyChoice>("AUTO");
  const [publishAfterReady, setPublishAfterReady] = useState(false);
  const { mediaState, setMediaState, loading, error, refresh } = useVideoMediaState(videoId);
  const uploadState = useVideoOriginalUpload(videoId);

  const submit = async () => {
    if (!file) return;
    try {
      const nextState = await uploadState.upload({ file, strategy: strategyFromChoice(strategyChoice), publishAfterReady });
      setMediaState(nextState);
      setFile(null);
      toast("Oryginał zapisany. Status źródeł jest aktualizowany poniżej.", "success");
      onChanged?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Nie udało się wgrać wideo.", "error");
    }
  };

  return <div className="space-y-5">
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div><h3 className="text-lg font-semibold">Wideo</h3><p className="text-sm text-muted-foreground">Wgraj oryginał i wybierz, gdzie ma powstać źródło odtwarzania.</p></div>
      <VideoUploadDropzone file={file} onFileChange={setFile} disabled={uploadState.uploading} />
      <VideoDistributionStrategySelect value={strategyChoice} onChange={setStrategyChoice} disabled={uploadState.uploading} />
      <div className="flex items-center gap-2">
        <Checkbox id="publish-after-ready" checked={publishAfterReady} onCheckedChange={(checked) => setPublishAfterReady(checked === true)} disabled={uploadState.uploading} />
        <Label htmlFor="publish-after-ready" className="text-sm">Opublikuj automatycznie, gdy gotowe</Label>
      </div>
      {uploadState.error && <p className="text-sm text-destructive">{uploadState.error}</p>}
      {uploadState.uploading && <p className="text-xs text-muted-foreground">Postęp: {uploadState.progress}%</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={!file || uploadState.uploading}>{uploadState.uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Zapisz oryginał i utwórz źródła</Button>
        {uploadState.uploading && <Button type="button" variant="outline" onClick={uploadState.cancel}>Anuluj</Button>}
      </div>
    </div>

    <div className="rounded-xl border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-base font-semibold">Status</h3><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Odśwież</Button></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <VideoPipelineTimeline mediaState={mediaState} />
    </div>

    <AdvancedVideoSourcesPanel videoId={videoId} assets={assets} tier={tier} onChanged={() => { void refresh(); onChanged?.(); }} />
  </div>;
}
