"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Loader2, Pause, Play, Upload, X } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { ALLOWED_VIDEO_EXTENSIONS, maxUploadBytes } from "@/lib/modules/video-pipeline/domain/upload-policy";
import { PipelineStatusCard } from "./PipelineStatusCard";
import { formatBytes, formatDuration } from "./pipeline-format";
import { useOriginalUpload } from "./useOriginalUpload";
import { useVideoPipeline } from "./useVideoPipeline";

interface Props {
  videoId: string;
  videoStatus?: string;
  /** Called when the pipeline reaches a final state or an action succeeds (refresh the parent). */
  onChanged?: () => void;
  /** Create flow: a file chosen on the "new video" form is uploaded at once. */
  initialFile?: File | null;
  autoStart?: boolean;
  publishAfterReady?: boolean;
}

/**
 * The only video source UI: upload the original (resumable, straight to R2), watch encoding
 * (progress, ETA, errors), re-encode, delete versions. No providers to choose from.
 */
export function VideoPipelinePanel({ videoId, videoStatus, onChanged, initialFile = null, autoStart = false, publishAfterReady = false }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(initialFile);
  const [publish, setPublish] = useState(publishAfterReady);
  const [fileError, setFileError] = useState<string | null>(null);
  const pipeline = useVideoPipeline(videoId, onChanged);
  const upload = useOriginalUpload(videoId);
  const autoStarted = useRef(false);
  const limit = maxUploadBytes({});

  const choose = (next: File | null) => {
    setFileError(null);
    if (next) {
      const ext = next.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(ALLOWED_VIDEO_EXTENSIONS as readonly string[]).includes(ext)) setFileError(`Dozwolone formaty: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.`);
      else if (next.size > limit) setFileError(`Plik jest za duży (limit ${formatBytes(limit)}).`);
    }
    upload.reset();
    setFile(next);
  };

  const begin = async () => {
    if (!file || fileError) return;
    const ok = await upload.start(file, publish);
    if (ok) {
      toast("Plik wysłany. Kodowanie ruszy za chwilę.", "success");
      setFile(null);
      await pipeline.refresh();
      onChanged?.();
    }
  };

  useEffect(() => {
    if (autoStart && initialFile && !autoStarted.current) {
      autoStarted.current = true;
      void begin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialFile]);

  const uploading = upload.phase === "uploading";
  const p = upload.progress;
  const state = pipeline.state;
  const encodingActive = state?.summary === "QUEUED" || state?.summary === "ENCODING";

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div>
          <h3 className="text-lg font-semibold">Wideo</h3>
          <p className="text-sm text-muted-foreground">
            Wgraj plik źródłowy. Trafia prosto do naszego magazynu, potem sami go kodujemy do HLS i odtwarzamy. Nie wybierasz żadnego zewnętrznego dostawcy.
          </p>
        </div>

        {encodingActive && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Trwa kodowanie. Nowy plik możesz wgrać po jego zakończeniu albo po anulowaniu.</p>}

        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <Label htmlFor="pipeline-file" className="font-semibold">Plik wideo</Label>
          <Input id="pipeline-file" type="file" accept="video/*,.mkv,.ts,.mts,.m2ts" disabled={uploading || encodingActive} onChange={(e) => choose(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">Formaty: {ALLOWED_VIDEO_EXTENSIONS.join(", ")}. Maksymalnie {formatBytes(limit)}. Przerwany upload można wznowić, wybierając ten sam plik.</p>
          {file && <p className="text-xs font-medium">Wybrano: {file.name} ({formatBytes(file.size)})</p>}
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="pipeline-publish" checked={publish} onCheckedChange={(c) => setPublish(c === true)} disabled={uploading} />
          <Label htmlFor="pipeline-publish" className="text-sm">Opublikuj automatycznie po zakodowaniu</Label>
        </div>

        {upload.phase === "error" && upload.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{upload.error}</span>
          </div>
        )}
        {upload.phase === "paused" && <p className="text-xs text-amber-800">Upload wstrzymany. Kliknij „Wznów”, żeby kontynuować od miejsca przerwania.</p>}

        {(uploading || (p && upload.phase === "paused")) && p && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}Wysyłanie do magazynu</span>
              <span className="font-mono">{p.percent.toFixed(1)}%</span>
            </div>
            <Progress value={p.percent} className="h-2" />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{formatBytes(p.uploadedBytes)} / {formatBytes(p.totalBytes)} · części {p.uploadedParts}/{p.partCount}</span>
              <span>{formatBytes(p.speedBps)}/s · pozostało {formatDuration(p.etaSeconds)}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!uploading && (
            <Button type="button" onClick={begin} disabled={!file || Boolean(fileError) || encodingActive}>
              {upload.phase === "paused" || upload.phase === "error" ? <Play className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
              {upload.phase === "paused" || upload.phase === "error" ? "Wznów upload" : "Wgraj i zakoduj"}
            </Button>
          )}
          {uploading && (
            <Button type="button" variant="outline" onClick={upload.pause}><Pause className="mr-2 h-4 w-4" /> Wstrzymaj</Button>
          )}
          {(uploading || upload.phase === "paused" || upload.phase === "error") && (
            <Button type="button" variant="outline" onClick={() => { void upload.cancel(file); }}><X className="mr-2 h-4 w-4" /> Anuluj upload</Button>
          )}
        </div>
      </div>

      {pipeline.error && <p className="text-sm text-destructive">{pipeline.error}</p>}
      {state && (
        <PipelineStatusCard
          state={state}
          busy={pipeline.busy}
          videoStatus={videoStatus}
          onReencode={() => void pipeline.reencode()}
          onCancel={(jobId) => void pipeline.cancel(jobId)}
          onDeleteAsset={(assetId) => void pipeline.deleteAsset(assetId)}
        />
      )}
    </div>
  );
}
