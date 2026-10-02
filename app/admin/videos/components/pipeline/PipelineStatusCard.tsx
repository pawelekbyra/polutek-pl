"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCcw, Trash2, X } from "@/app/components/icons";
import type { PipelineStateDto } from "@/lib/modules/video-pipeline";
import { STAGE_LABEL, SUMMARY_LABEL, formatBytes, formatDuration } from "./pipeline-format";

const TONE_CLASS = {
  neutral: "bg-muted text-muted-foreground",
  busy: "bg-blue-100 text-blue-900",
  ok: "bg-green-100 text-green-800",
  bad: "bg-red-100 text-red-800",
} as const;

interface Props {
  state: PipelineStateDto;
  busy: boolean;
  videoStatus?: string;
  onReencode: () => void;
  onCancel: (jobId: string) => void;
  onDeleteAsset: (assetId: string) => void;
}

/** Encoding status, progress/ETA, failure reason and the encoded versions of one video. */
export function PipelineStatusCard({ state, busy, videoStatus, onReencode, onCancel, onDeleteAsset }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { job, summary, original, assets } = state;
  const label = SUMMARY_LABEL[summary];
  const running = job && (job.status === "QUEUED" || job.status === "RUNNING");
  const canReencode = Boolean(original && original.status === "READY" && !running);
  const workerMissing = summary === "QUEUED" && !state.workerAlive;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Przetwarzanie</h3>
        <Badge className={`${TONE_CLASS[label.tone]} hover:${TONE_CLASS[label.tone]}`}>{label.text}</Badge>
      </div>

      {original && (
        <p className="text-xs text-muted-foreground">
          Oryginał: <span className="font-medium text-foreground">{original.fileName ?? "plik"}</span>
          {original.sizeBytes ? ` · ${formatBytes(Number(original.sizeBytes))}` : ""} · wersja {original.version}
        </p>
      )}

      {running && job && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {job.status === "RUNNING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              {job.status === "QUEUED" ? (job.nextAttemptAt ? "Czeka na ponowną próbę" : "W kolejce") : STAGE_LABEL[job.stage]}
              {job.cancelRequested && " (anulowanie…)"}
            </span>
            <span className="font-mono">{job.progressPercent}%</span>
          </div>
          <Progress value={job.progressPercent} className="h-2" />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>Próba {Math.max(1, job.attemptCount)} z {job.maxAttempts}</span>
            {job.status === "RUNNING" && <span>Pozostało: {formatDuration(job.etaSeconds)}</span>}
            {job.status === "RUNNING" && !job.heartbeatFresh && <span className="text-amber-700">brak sygnału od workera…</span>}
          </div>
          {job.failureReason && job.status === "QUEUED" && <p className="text-xs text-amber-700">Poprzednia próba: {job.failureReason}</p>}
          <Button type="button" variant="outline" size="sm" disabled={busy || job.cancelRequested} onClick={() => onCancel(job.id)}>
            <X className="mr-1 h-3.5 w-3.5" /> Anuluj kodowanie
          </Button>
        </div>
      )}

      {workerMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Worker kodowania nie odpowiada. Zadanie czeka w kolejce i ruszy, gdy worker wróci (kontener <code>encoder</code> na serwerze).</span>
        </div>
      )}

      {job?.status === "FAILED" && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Kodowanie nie powiodło się{job.failureCode ? ` (${job.failureCode})` : ""}</p>
          <p className="text-xs">{job.failureReason ?? "Nieznany błąd."}</p>
        </div>
      )}

      {job?.status === "CANCELLED" && summary === "CANCELLED" && <p className="text-xs text-muted-foreground">Kodowanie anulowano. Możesz uruchomić je ponownie.</p>}

      {summary === "UPLOAD_FAILED" && original?.failureReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">{original.failureReason}</div>
      )}

      {canReencode && (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReencode}>
          <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Zakoduj ponownie
        </Button>
      )}

      {assets.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Wersje HLS</h4>
          {assets.map((asset) => {
            const locked = asset.isActive && videoStatus === "PUBLISHED";
            return (
              <div key={asset.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                <span className="flex items-center gap-2">
                  {asset.isActive ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="h-4 w-4" />}
                  v{asset.versionNumber}
                  {asset.isActive && <Badge variant="secondary" className="text-[10px]">gra</Badge>}
                  {asset.sizeBytes ? <span className="text-xs text-muted-foreground">{formatBytes(asset.sizeBytes)}</span> : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || locked}
                  title={locked ? "Gra opublikowany film: najpierw cofnij publikację albo zakoduj ponownie" : "Usuń tę wersję z magazynu"}
                  onClick={() => {
                    if (confirmId === asset.id) { setConfirmId(null); onDeleteAsset(asset.id); } else setConfirmId(asset.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />{confirmId === asset.id && <span className="ml-1 text-xs">Potwierdź usunięcie</span>}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
