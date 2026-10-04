"use client";
/**
 * Encoding of one film, live: stages, progress, failure log, HLS versions, and the actions (re-encode,
 * cancel, delete an old version). Polls the pipeline every 3 s only while something runs.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { PipelineStateDto } from "@/lib/modules/video-pipeline";
import { encodeAction } from "@admin/app/(panel)/tresci/actions";
import { ConfirmDialog, type ConfirmOptions } from "@admin/components/confirm-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

const STAGES = [
  ["UPLOAD", "Oryginał wgrany"],
  ["PROBING", "Analiza (ffprobe)"],
  ["ENCODING", "Kodowanie"],
  ["UPLOADING", "Wysyłka do R2"],
  ["DONE", "Aktywna trasa"],
] as const;
const STAGE_INDEX: Record<string, number> = { QUEUED: 1, DOWNLOADING: 1, PROBING: 1, ENCODING: 2, UPLOADING: 3, FINALIZING: 4, DONE: 5 };
const STAGE_WORD: Record<string, string> = { QUEUED: "w kolejce", DOWNLOADING: "pobieranie oryginału", PROBING: "analiza pliku", ENCODING: "kodowanie rendycji", UPLOADING: "wysyłka do R2", FINALIZING: "aktywacja wersji", DONE: "gotowe" };
const RUNNING = new Set(["UPLOADING", "QUEUED", "ENCODING"]);

const gb = (bytes: number | string | null | undefined) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} GB` : `${Math.round(n / 1024 ** 2).toLocaleString("pl-PL")} MB`;
};
const mins = (s: number | null) => (s === null ? null : s < 90 ? "niecała 2 min" : `ok. ${Math.round(s / 60)} min`);

type Pending = { op: "reencode" | "cancel" | "delete-asset"; assetId?: string; version?: number } | null;

export function EncodePanel({ videoId, slug, initial }: { videoId: string; slug: string; initial: PipelineStateDto | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState(initial);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const summary = state?.summary ?? "NO_ORIGINAL";
  const running = RUNNING.has(summary);

  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/pipeline`, { cache: "no-store" }).catch(() => null);
      const next = res?.ok ? ((await res.json()) as PipelineStateDto | null) : null;
      if (stop || !next) return;
      setState(next);
      if (!RUNNING.has(next.summary)) router.refresh();
    };
    const t = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [running, videoId, router]);

  const job = state?.job ?? null;
  const done = summary === "READY" ? 5 : job ? STAGE_INDEX[job.stage] ?? 0 : state?.original?.status === "READY" ? 1 : 0;
  const failed = summary === "FAILED";

  const run = (p: NonNullable<Pending>) =>
    start(async () => {
      const res = await encodeAction({ videoId, slug, op: p.op, jobId: job?.id, assetId: p.assetId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setConfirm(null);
      toast("ok", res.message ?? "Zlecono");
      router.refresh();
    });

  const options: ConfirmOptions | null = !confirm
    ? null
    : confirm.op === "reencode"
      ? { title: "Zakodować film ponownie?", confirm: "Zakoduj ponownie", effect: ["powstaje nowa wersja HLS z obecnego oryginału", "obecna wersja gra, dopóki nowa nie będzie gotowa", "wpis VIDEO_REENCODE_REQUESTED w audycie"] }
      : confirm.op === "cancel"
        ? { title: "Anulować kodowanie?", confirm: "Anuluj kodowanie", danger: true, effect: ["encoder przerywa przy najbliższym sygnale", "częściowe pliki w R2 są sprzątane", "obecna wersja (jeśli jest) gra dalej"] }
        : { title: `Usunąć wersję HLS v${confirm.version}?`, confirm: "Usuń wersję", danger: true, effect: ["pliki tej wersji znikają z R2", "aktywnej wersji nie da się usunąć"] };

  return (
    <>
      <ol className="pipeline" aria-label="Etapy kodowania">
        {STAGES.map(([key, label], i) => {
          const isDone = i < done;
          const isNow = i === done && (running || failed);
          return (
            <li key={key} className={isDone ? "done" : isNow ? "now" : ""}>
              <span className={`state ${isDone ? "ok" : isNow ? (failed ? "crit" : "info") : ""}`}>
                {isDone || isNow ? <Icon name={isDone ? "ok" : failed ? "crit" : "info"} /> : null}
                <span className={isDone || isNow ? "" : "muted"}>
                  {label}
                  {isNow && !failed && key === "ENCODING" && job ? ` ${job.progressPercent}%` : ""}
                </span>
              </span>
              <span className="muted">{stageNote(key, state)}</span>
            </li>
          );
        })}
      </ol>
      {running && job ? (
        <div className="upload-progress">
          <div className="limit-head">
            <span className="limit-name">{summary === "QUEUED" ? "W kolejce" : `Etap: ${STAGE_WORD[job.stage] ?? job.stage}`}</span>
            <span className="limit-val">{job.progressPercent}%{mins(job.etaSeconds) ? ` · ${mins(job.etaSeconds)}` : ""}</span>
          </div>
          <div className="meter" role="progressbar" aria-label="Postęp kodowania" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progressPercent}>
            <div className={`meter-fill pw-${Math.max(0, Math.min(100, job.progressPercent))}`} />
          </div>
          <span className="limit-note">
            {state?.workerAlive ? "encoder żyje" : "encoder nie odpowiada (sprawdź ekran System)"} · próba {job.attemptCount} z {job.maxAttempts}
            {job.cancelRequested ? " · anulowanie zlecone" : ""}
          </span>
        </div>
      ) : null}
      {failed && job ? (
        <div className="banner crit mb-3 banner-meter">
          <Icon name="crit" />
          <div className="banner-body">
            <span className="banner-title">Kodowanie przerwane{job.failureCode ? ` (${job.failureCode})` : ""}</span>
            <span className="text-2">Próba {job.attemptCount} z {job.maxAttempts}. Pełny log ma kontener encoder (docs/operations/VIDEO-PIPELINE.md, „Diagnostyka”).</span>
            {job.failureReason ? <pre className="log-box">{job.failureReason}</pre> : null}
          </div>
        </div>
      ) : null}
      {state?.hasCompetingSource ? <p className="muted">Film ma też stare źródło innego dostawcy; po gotowym HLS przestaje ono mieć znaczenie.</p> : null}
      {state?.assets.length ? (
        <>
          <h3 className="section-title">Wersje HLS</h3>
          <div className="table-scroll">
            <table className="table table-compact responsive">
              <caption className="sr-only">Wersje HLS filmu</caption>
              <thead>
                <tr>
                  <th scope="col">Wersja</th>
                  <th scope="col">Stan</th>
                  <th scope="col" className="num">Rozmiar</th>
                  <th scope="col">Utworzona</th>
                  <th scope="col">
                    <span className="sr-only">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.assets.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-first mono">v{a.versionNumber}</td>
                    <td data-label="Stan">{a.isActive ? <span className="state ok"><Icon name="ok" /><span>Aktywna</span></span> : <span className="muted">Poprzednia</span>}</td>
                    <td data-label="Rozmiar" className="num">{gb(a.sizeBytes)}</td>
                    <td data-label="Utworzona">{new Date(a.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="actions">
                      {a.isActive ? null : (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setError(null); setConfirm({ op: "delete-asset", assetId: a.id, version: a.versionNumber }); }}>
                          <Icon name="trash" />
                          Usuń
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <div className="row mt-3">
        {running ? (
          <button type="button" className="btn btn-sm" onClick={() => { setError(null); setConfirm({ op: "cancel" }); }} disabled={!job || job.cancelRequested}>
            Anuluj kodowanie
          </button>
        ) : state?.original?.status === "READY" ? (
          <button type="button" className={`btn btn-sm${failed ? " btn-primary" : ""}`} onClick={() => { setError(null); setConfirm({ op: "reencode" }); }}>
            <Icon name="refresh" />
            {failed ? "Ponów kodowanie" : "Zakoduj ponownie"}
          </button>
        ) : null}
      </div>
      <ConfirmDialog open={!!confirm} options={options} busy={pending} error={error} onConfirm={() => confirm && run(confirm)} onClose={() => setConfirm(null)} />
    </>
  );
}

function stageNote(key: string, s: PipelineStateDto | null): string {
  if (!s) return "";
  if (key === "UPLOAD") return s.original ? `${gb(s.original.sizeBytes)}${s.original.status === "READY" ? " · sprawdzony" : ` · ${s.original.status.toLowerCase()}`}` : "brak pliku";
  if (key === "ENCODING") return "rendycje 1080p…240p";
  if (key === "UPLOADING") return "master.m3u8 na końcu";
  if (key === "DONE") return s.assets.find((a) => a.isActive) ? `SELF_HLS · v${s.assets.find((a) => a.isActive)!.versionNumber}` : "—";
  return "";
}
