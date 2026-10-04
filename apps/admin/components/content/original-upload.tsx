"use client";
/**
 * Upload of the ORIGINAL film: straight from the browser to the private R2 bucket in parts (presigned URLs
 * from the panel), resumable after a closed tab, verified by the server at the end, then encoding starts
 * by itself. Same uploader as the old panel (lib/video-upload/multipart-uploader.ts), panel API base.
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadError, cancelUpload, uploadOriginal, type UploadProgress } from "@/lib/video-upload/multipart-uploader";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

const API_BASE = "/api/videos";
type Phase = "idle" | "uploading" | "paused" | "done" | "error";

const size = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} GB` : `${Math.round(b / 1024 ** 2).toLocaleString("pl-PL")} MB`);
const eta = (s: number | null) => (s === null ? "liczę czas…" : s < 60 ? "zostało mniej niż minuta" : `zostało ok. ${Math.round(s / 60)} min`);

export function OriginalUpload({ videoId, hasOriginal, canPublish }: { videoId: string; hasOriginal: boolean; canPublish: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(false);
  const [over, setOver] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const start = async (f: File) => {
    if (phase === "uploading") return;
    setFile(f);
    const c = new AbortController();
    ctrl.current = c;
    setPhase("uploading");
    setError(null);
    setProgress(null);
    try {
      await uploadOriginal({ videoId, file: f, publishAfterReady: canPublish && publish, signal: c.signal, onProgress: setProgress, apiBase: API_BASE });
      setPhase("done");
      toast("ok", "Oryginał wgrany i sprawdzony", "Kodowanie w kolejce; postęp na stronie filmu.");
      router.refresh();
    } catch (e) {
      if (c.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) setPhase("paused");
      else {
        setError(e instanceof UploadError || e instanceof Error ? e.message : "Nie udało się wgrać pliku.");
        setPhase("error");
      }
    } finally {
      ctrl.current = null;
    }
  };

  const pct = Math.floor(progress?.percent ?? 0);
  return (
    <section className="card" id="oryginal" aria-labelledby="h-up">
      <div className="card-head">
        <h2 id="h-up">Oryginał wideo</h2>
        <p className="sub">
          Plik idzie prosto do prywatnego R2 w częściach (wznawianie po zerwaniu: wybierz ten sam plik jeszcze raz). Serwer sprawdza rozmiar i nagłówek pliku, potem kodowanie startuje samo.
          {hasOriginal ? " Nowy plik zastąpi obecny dopiero, gdy jego wersja HLS będzie gotowa." : ""}
        </p>
      </div>
      <div
        className={`dropzone${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void start(f);
        }}
      >
        <Icon name="upload" large />
        <div>
          <strong>Przeciągnij plik albo wybierz z dysku</strong>
          <span className="muted">MP4, MOV, MKV albo WebM; najlepiej 1080p lub 4K</span>
        </div>
        <input
          ref={input}
          type="file"
          accept="video/*,.mkv,.mov"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void start(f);
          }}
        />
        <button type="button" className="btn" onClick={() => input.current?.click()} aria-disabled={phase === "uploading"}>
          Wybierz plik…
        </button>
      </div>
      {canPublish ? (
        <label className="choice mt-3">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={phase === "uploading"} />
          <span>Opublikuj film automatycznie, gdy kodowanie się skończy</span>
        </label>
      ) : null}
      {phase !== "idle" && file ? (
        <div className="upload-progress" aria-live="polite">
          <div className="limit-head">
            <span className="limit-name">
              {file.name} · {size(file.size)}
            </span>
            <span className="limit-val">{phase === "done" ? "100%" : `${pct}%`}</span>
          </div>
          <div className="meter" role="progressbar" aria-label="Postęp wgrywania" aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === "done" ? 100 : pct}>
            <div className={`meter-fill pw-${phase === "done" ? 100 : pct}`} />
          </div>
          <span className="limit-note">
            {phase === "uploading" && progress ? `część ${progress.uploadedParts} z ${progress.partCount} · ${eta(progress.etaSeconds)} · można zamknąć kartę i wrócić` : null}
            {phase === "paused" ? "wstrzymane: wybierz ten sam plik, żeby wznowić" : null}
            {phase === "done" ? "wgrane i sprawdzone · kodowanie w kolejce" : null}
          </span>
          <div className="row">
            {phase === "uploading" ? (
              <button type="button" className="btn btn-sm" onClick={() => ctrl.current?.abort()}>
                Wstrzymaj
              </button>
            ) : null}
            {phase === "uploading" || phase === "paused" || phase === "error" ? (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={async () => {
                  ctrl.current?.abort();
                  await cancelUpload(videoId, file, undefined, undefined, API_BASE);
                  setPhase("idle");
                  setProgress(null);
                  setError(null);
                }}
              >
                Porzuć wgrywanie
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="form-error mt-3" role="alert">
          <Icon name="crit" />
          {error}
        </p>
      ) : null}
    </section>
  );
}
