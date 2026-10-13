"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { StudioApiError, jsonBody, studioApi, type StudioVideo, type StudioVideoList } from "./studio-client";
import { uploadOriginal, type UploadProgress } from "./upload-original";
import { Badge, Card, Field, Notice, ProgressBar, buttonClass, dangerButtonClass, ghostButtonClass, inputClass } from "./ui";

type View = { kind: "list" } | { kind: "upload" } | { kind: "edit"; id: string };

/** Studio -> Content: the channel's videos, the upload wizard and the video editor. */
export default function StudioContent() {
  const [view, setView] = useState<View>({ kind: "list" });
  if (view.kind === "upload") {
    return <UploadPanel onCancel={() => setView({ kind: "list" })} onUploaded={(id) => setView({ kind: "edit", id })} />;
  }
  if (view.kind === "edit") {
    return <VideoEditor id={view.id} onBack={() => setView({ kind: "list" })} />;
  }
  return <VideoList onUpload={() => setView({ kind: "upload" })} onEdit={(id) => setView({ kind: "edit", id })} />;
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof StudioApiError ? e.message : fallback;
}

function VideoList({ onUpload, onEdit }: { onUpload: () => void; onEdit: (id: string) => void }) {
  const { tx } = useLanguage();
  const [list, setList] = useState<StudioVideoList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    studioApi<StudioVideoList>("/api/studio/videos?limit=50")
      .then((data) => !cancelled && setList(data))
      .catch((e) => !cancelled && setError(errorText(e, tx("Nie udało się wczytać filmów.", "Could not load videos."))));
    return () => {
      cancelled = true;
    };
  }, [tx]);

  const statusLabel: Record<StudioVideo["status"], string> = {
    DRAFT: tx("Szkic", "Draft"),
    PUBLISHED: tx("Opublikowany", "Published"),
    UNLISTED: tx("Niepubliczny", "Unlisted"),
    ARCHIVED: tx("Zarchiwizowany", "Archived"),
  };

  return (
    <Card
      title={tx("Twoje filmy", "Your videos")}
      actions={
        <button type="button" className={buttonClass} onClick={onUpload}>
          {tx("Prześlij film", "Upload a video")}
        </button>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      {!list && !error && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>}
      {list && list.items.length === 0 && (
        <p className="text-[14px] text-[var(--chan-muted)]">{tx("Nie masz jeszcze żadnych filmów. Prześlij pierwszy.", "You have no videos yet. Upload your first one.")}</p>
      )}
      {list && list.items.length > 0 && (
        <ul className="divide-y divide-[var(--chan-line)]">
          {list.items.map((video) => (
            <li key={video.id} className="flex flex-wrap items-center gap-3 py-3">
              {/* The list DTO's thumbnailUrl is already a public src (proxy path or public bucket URL). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.thumbnailUrl || `/api/videos/${encodeURIComponent(video.id)}/thumbnail`}
                alt=""
                loading="lazy"
                width={160}
                height={90}
                className="h-[54px] w-24 shrink-0 rounded-lg bg-[var(--chan-surface)] object-cover sm:h-[72px] sm:w-32"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--chan-ink)]">{video.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--chan-muted)]">
                  <Badge tone={video.status === "PUBLISHED" ? "good" : "neutral"}>{statusLabel[video.status]}</Badge>
                  <span>{video.tier === "PUBLIC" ? tx("Dla wszystkich", "Public") : tx("Dla zalogowanych", "Signed-in only")}</span>
                  <span>{tx("{0} wyświetleń", "{0} views", video.views)}</span>
                </p>
              </div>
              <button type="button" className={ghostButtonClass} onClick={() => onEdit(video.id)}>
                {tx("Edytuj", "Edit")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function fileTitle(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 100) || "Film";
}

function UploadPanel({ onCancel, onUploaded }: { onCancel: () => void; onUploaded: (id: string) => void }) {
  const { tx } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<"PUBLIC" | "LOGGED_IN">("PUBLIC");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // The draft exists as soon as the file is chosen, so nothing typed is lost if the upload fails.
      const draft = await studioApi<{ id: string }>("/api/studio/videos", {
        method: "POST",
        ...jsonBody({ title: title.trim() || fileTitle(file.name), tier }),
      });
      await uploadOriginal({
        videoId: draft.id,
        file,
        fileName: file.name,
        contentType: file.type || undefined,
        signal: controller.signal,
        onProgress: setProgress,
      });
      onUploaded(draft.id);
    } catch (e) {
      setError(errorText(e, tx("Przesyłanie nie powiodło się. Spróbuj ponownie.", "Upload failed. Please try again.")));
      setBusy(false);
    }
  };

  const percent = progress && progress.totalBytes > 0 ? (progress.uploadedBytes / progress.totalBytes) * 100 : 0;

  return (
    <Card title={tx("Prześlij film", "Upload a video")}>
      <div className="grid max-w-xl gap-4">
        <Field label={tx("Plik wideo", "Video file")} htmlFor="studio-file" hint={tx("MP4, MOV, MKV, WebM lub AVI.", "MP4, MOV, MKV, WebM or AVI.")}>
          <input
            id="studio-file"
            type="file"
            accept="video/*"
            disabled={busy}
            className={inputClass}
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              if (chosen && !title) setTitle(fileTitle(chosen.name));
            }}
          />
        </Field>
        <Field label={tx("Tytuł", "Title")} htmlFor="studio-title">
          <input id="studio-title" className={inputClass} value={title} maxLength={100} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={tx("Kto może oglądać", "Who can watch")} htmlFor="studio-tier">
          <select id="studio-tier" className={inputClass} value={tier} disabled={busy} onChange={(e) => setTier(e.target.value as "PUBLIC" | "LOGGED_IN")}>
            <option value="PUBLIC">{tx("Wszyscy", "Everyone")}</option>
            <option value="LOGGED_IN">{tx("Tylko zalogowani", "Signed-in viewers only")}</option>
          </select>
        </Field>
        {progress && (
          <div className="grid gap-2">
            <ProgressBar value={percent} />
            <p className="text-[12px] text-[var(--chan-muted)]">
              {tx("Przesłano {0}%", "Uploaded {0}%", Math.round(percent))}
            </p>
          </div>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!file || busy} onClick={start}>
            {busy ? tx("Przesyłam…", "Uploading…") : tx("Prześlij", "Upload")}
          </button>
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              abortRef.current?.abort();
              onCancel();
            }}
          >
            {busy ? tx("Przerwij", "Cancel") : tx("Wróć", "Back")}
          </button>
        </div>
      </div>
    </Card>
  );
}

interface PipelineView {
  summary: "NO_ORIGINAL" | "UPLOADING" | "QUEUED" | "ENCODING" | "READY" | "FAILED" | "CANCELLED" | "UPLOAD_FAILED";
  job: { id: string; progressPercent: number; stage: string; failureReason: string | null } | null;
  original: { failureReason: string | null } | null;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function VideoEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const { tx } = useLanguage();
  const [video, setVideo] = useState<StudioVideo | null>(null);
  const [pipeline, setPipeline] = useState<PipelineView | null>(null);
  const [form, setForm] = useState({ title: "", titleEn: "", description: "", descriptionEn: "", tier: "PUBLIC" as "PUBLIC" | "LOGGED_IN", premiere: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  const base = `/api/studio/videos/${encodeURIComponent(id)}`;

  const loadVideo = useCallback(async () => {
    const data = await studioApi<StudioVideo>(base);
    setVideo(data);
    setForm({
      title: data.title,
      titleEn: data.titleEn ?? "",
      description: data.description ?? "",
      descriptionEn: data.descriptionEn ?? "",
      tier: data.tier,
      premiere: toLocalInput(data.premiereAt),
    });
  }, [base]);

  useEffect(() => {
    loadVideo().catch((e) => setMessage({ kind: "error", text: errorText(e, tx("Nie udało się wczytać filmu.", "Could not load the video.")) }));
  }, [loadVideo, tx]);

  // The encoding state is polled while something is in progress.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const state = await studioApi<PipelineView>(`${base}/pipeline`);
        if (cancelled) return;
        setPipeline(state);
        if (["UPLOADING", "QUEUED", "ENCODING"].includes(state.summary)) timer = setTimeout(poll, 4000);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 8000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [base]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await loadVideo();
      setMessage({ kind: "success", text: success });
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e, tx("Nie udało się zapisać zmian.", "Could not save the changes.")) });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(
      () =>
        studioApi(base, {
          method: "PATCH",
          ...jsonBody({
            title: form.title,
            titleEn: form.titleEn || null,
            description: form.description || null,
            descriptionEn: form.descriptionEn || null,
            tier: form.tier,
            premiereAt: form.premiere ? new Date(form.premiere).toISOString() : null,
          }),
        }),
      tx("Zapisano.", "Saved."),
    );

  const uploadCover = async (file: File) => {
    const body = new FormData();
    body.set("file", file);
    await run(() => studioApi(`${base}/cover`, { method: "POST", body }), tx("Miniatura zapisana.", "Thumbnail saved."));
  };

  const remove = async () => {
    setBusy(true);
    try {
      await studioApi(base, { method: "DELETE" });
      onBack();
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e, tx("Nie udało się usunąć filmu.", "Could not delete the video.")) });
      setBusy(false);
    }
  };

  if (!video) {
    return message ? <Notice kind="error">{message.text}</Notice> : <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>;
  }

  const ready = pipeline?.summary === "READY";
  const pipelineLabel: Record<PipelineView["summary"], string> = {
    NO_ORIGINAL: tx("Brak pliku", "No file"),
    UPLOADING: tx("Przesyłanie", "Uploading"),
    QUEUED: tx("W kolejce do przetwarzania", "Waiting to be processed"),
    ENCODING: tx("Przetwarzanie", "Processing"),
    READY: tx("Gotowy do publikacji", "Ready to publish"),
    FAILED: tx("Przetwarzanie nie powiodło się", "Processing failed"),
    CANCELLED: tx("Anulowano", "Cancelled"),
    UPLOAD_FAILED: tx("Przesyłanie nie powiodło się", "Upload failed"),
  };

  return (
    <div className="grid gap-4">
      <div>
        <button type="button" className={ghostButtonClass} onClick={onBack}>
          {tx("← Wróć do filmów", "← Back to videos")}
        </button>
      </div>

      <Card title={tx("Przetwarzanie", "Processing")}>
        <div className="grid gap-2">
          <p className="text-[14px] text-[var(--chan-ink)]">
            {pipeline ? pipelineLabel[pipeline.summary] : tx("Sprawdzam…", "Checking…")}
          </p>
          {pipeline?.job && pipeline.summary === "ENCODING" && <ProgressBar value={pipeline.job.progressPercent} />}
          {(pipeline?.summary === "FAILED" || pipeline?.summary === "UPLOAD_FAILED") && (
            <Notice kind="error">
              {pipeline.job?.failureReason ?? pipeline.original?.failureReason ?? tx("Spróbuj przesłać plik ponownie.", "Try uploading the file again.")}
            </Notice>
          )}
        </div>
      </Card>

      <Card title={tx("Szczegóły", "Details")}>
        <div className="grid max-w-2xl gap-4">
          <Field label={tx("Tytuł (PL)", "Title (PL)")} htmlFor="ed-title">
            <input id="ed-title" className={inputClass} value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label={tx("Tytuł (EN)", "Title (EN)")} htmlFor="ed-title-en">
            <input id="ed-title-en" className={inputClass} value={form.titleEn} maxLength={100} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
          </Field>
          <Field label={tx("Opis (PL)", "Description (PL)")} htmlFor="ed-desc">
            <textarea id="ed-desc" className={inputClass} rows={4} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label={tx("Opis (EN)", "Description (EN)")} htmlFor="ed-desc-en">
            <textarea id="ed-desc-en" className={inputClass} rows={4} maxLength={5000} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
          </Field>
          <Field label={tx("Kto może oglądać", "Who can watch")} htmlFor="ed-tier">
            <select id="ed-tier" className={inputClass} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as "PUBLIC" | "LOGGED_IN" })}>
              <option value="PUBLIC">{tx("Wszyscy", "Everyone")}</option>
              <option value="LOGGED_IN">{tx("Tylko zalogowani", "Signed-in viewers only")}</option>
            </select>
          </Field>
          <Field
            label={tx("Premiera (opcjonalnie)", "Premiere (optional)")}
            htmlFor="ed-premiere"
            hint={tx("Zostaw puste, aby opublikować od razu.", "Leave empty to publish at once.")}
          >
            <input id="ed-premiere" type="datetime-local" className={inputClass} value={form.premiere} onChange={(e) => setForm({ ...form, premiere: e.target.value })} />
          </Field>
          <Field label={tx("Miniatura", "Thumbnail")} htmlFor="ed-cover" hint={tx("JPG, PNG lub WebP do 5 MB.", "JPG, PNG or WebP up to 5 MB.")}>
            <input
              id="ed-cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className={inputClass}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadCover(f);
              }}
            />
          </Field>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={busy || !form.title.trim()} onClick={save}>
              {tx("Zapisz", "Save")}
            </button>
            {video.status !== "PUBLISHED" ? (
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy || !ready}
                title={ready ? undefined : tx("Film musi się najpierw przetworzyć.", "The video has to finish processing first.")}
                onClick={() =>
                  run(() => studioApi(`${base}/publish`, { method: "POST", ...jsonBody({ action: "publish" }) }), tx("Film opublikowany.", "Video published."))
                }
              >
                {tx("Opublikuj", "Publish")}
              </button>
            ) : (
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy}
                onClick={() =>
                  run(() => studioApi(`${base}/publish`, { method: "POST", ...jsonBody({ action: "archive" }) }), tx("Film zarchiwizowany.", "Video archived."))
                }
              >
                {tx("Zarchiwizuj", "Archive")}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title={tx("Usuń film", "Delete video")}>
        <div className="grid max-w-xl gap-3">
          <p className="text-[14px] text-[var(--chan-muted)]">
            {tx("Usunięcie jest ostateczne: znikają film, komentarze i pliki. Wpisz tytuł filmu, aby potwierdzić.", "Deleting is final: the video, its comments and its files are removed. Type the video title to confirm.")}
          </p>
          <input className={inputClass} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} aria-label={tx("Tytuł filmu", "Video title")} />
          <div>
            <button type="button" className={dangerButtonClass} disabled={busy || confirmDelete.trim() !== video.title.trim()} onClick={remove}>
              {tx("Usuń film", "Delete video")}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
