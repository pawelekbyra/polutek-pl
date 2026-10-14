"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { StudioApiError, jsonBody, studioApi, studioThumbnailSrc, type StudioVideo } from "./studio-client";
import { confirmLeave, setUnsavedWork } from "./unsaved-guard";
import { DESCRIPTION_MAX, TITLE_MAX, isFormDirty, toLocalInput, validateCoverFile, visibilityAction, type EditorForm, type EditorVisibility } from "./video-form";
import VideoMoreOptions from "./VideoMoreOptions";
import { Badge, Card, CharCounter, Field, Notice, ProgressBar, buttonClass, dangerButtonClass, ghostButtonClass, inputClass, smallGhostButtonClass } from "./ui";

export interface PipelineView {
  summary: "NO_ORIGINAL" | "UPLOADING" | "QUEUED" | "ENCODING" | "READY" | "FAILED" | "CANCELLED" | "UPLOAD_FAILED";
  job: { id: string; progressPercent: number; stage: string; failureReason: string | null } | null;
  original: { failureReason: string | null } | null;
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof StudioApiError ? e.message : fallback;
}

function toForm(video: StudioVideo): EditorForm {
  return {
    title: video.title,
    titleEn: video.titleEn ?? "",
    description: video.description ?? "",
    descriptionEn: video.descriptionEn ?? "",
    tier: video.tier,
    premiere: toLocalInput(video.premiereAt),
    tags: video.tags ?? [],
    category: video.category ?? "",
    commentsMode: video.commentsMode ?? "ON",
    isAdult: video.isAdult === true,
  };
}

/** Studio -> video editor: form on the left, preview card (thumbnail, processing, status, link) on the right. */
export default function StudioVideoEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const { tx, language } = useLanguage();
  const [video, setVideo] = useState<StudioVideo | null>(null);
  const [pipeline, setPipeline] = useState<PipelineView | null>(null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [baseline, setBaseline] = useState<EditorForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<EditorVisibility | null>(null);

  const base = `/api/studio/videos/${encodeURIComponent(id)}`;
  const dirty = form !== null && isFormDirty(form, baseline);

  /** `resetForm` replaces what the creator typed with the saved values; leave it off while editing. */
  const loadVideo = useCallback(
    async (resetForm: boolean) => {
      const data = await studioApi<StudioVideo>(base);
      setVideo(data);
      if (resetForm) {
        const next = toForm(data);
        setForm(next);
        setBaseline(next);
      }
    },
    [base],
  );

  useEffect(() => {
    loadVideo(true).catch((e) => setMessage({ kind: "error", text: errorText(e, tx("Nie udało się wczytać filmu.", "Could not load the video.")) }));
  }, [loadVideo, tx]);

  // Leaving with unsaved changes asks first (reload and tab close through beforeunload, in-app moves through confirmLeave).
  useEffect(() => {
    setUnsavedWork(dirty);
    return () => setUnsavedWork(false);
  }, [dirty]);

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

  // A video that publishes itself after processing changes status without the creator doing anything.
  const summary = pipeline?.summary;
  useEffect(() => {
    if (summary === "READY") void loadVideo(false).catch(() => undefined);
  }, [summary, loadVideo]);

  const run = async (action: () => Promise<unknown>, success: string, resetForm: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await loadVideo(resetForm);
      setMessage({ kind: "success", text: success });
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e, tx("Nie udało się zapisać zmian.", "Could not save the changes.")) });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!form) return;
    return run(
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
            tags: form.tags,
            category: form.category || null,
            commentsMode: form.commentsMode,
            isAdult: form.isAdult,
          }),
        }),
      tx("Zapisano.", "Saved."),
      true,
    );
  };

  const uploadCover = async (file: File) => {
    const problem = validateCoverFile(file);
    if (problem) {
      setMessage({
        kind: "error",
        text:
          problem === "TYPE"
            ? tx("Miniatura musi być plikiem JPG, PNG lub WebP.", "The thumbnail must be a JPG, PNG or WebP file.")
            : tx("Miniatura może mieć najwyżej 5 MB.", "The thumbnail can be at most 5 MB."),
      });
      return;
    }
    const body = new FormData();
    body.set("file", file);
    // Only the video is refreshed: text typed in the form is not touched.
    await run(() => studioApi(`${base}/cover`, { method: "POST", body }), tx("Miniatura zapisana.", "Thumbnail saved."), false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await studioApi(base, { method: "DELETE" });
      setUnsavedWork(false);
      onBack();
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e, tx("Nie udało się usunąć filmu.", "Could not delete the video.")) });
      setBusy(false);
    }
  };

  const back = () => {
    if (!confirmLeave(tx("Masz niezapisane zmiany. Wyjść bez zapisywania?", "You have unsaved changes. Leave without saving?"))) return;
    setUnsavedWork(false);
    onBack();
  };

  const watchUrl = useMemo(() => {
    if (!video || typeof window === "undefined") return "";
    try {
      return `${window.location.origin}${getLocalizedHref(language as Locale, "watch", { slug: video.slug })}`;
    } catch {
      return "";
    }
  }, [video, language]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(watchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setMessage({ kind: "error", text: tx("Nie udało się skopiować. Zaznacz link i skopiuj go ręcznie.", "Could not copy. Select the link and copy it by hand.") });
    }
  };

  if (!video || !form) {
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
  const statusLabel: Record<StudioVideo["status"], string> = {
    DRAFT: tx("Szkic", "Draft"),
    PUBLISHED: tx("Opublikowany", "Published"),
    UNLISTED: tx("Niepubliczny", "Unlisted"),
    ARCHIVED: tx("Zarchiwizowany", "Archived"),
  };
  const published = video.status === "PUBLISHED";
  const unlisted = video.status === "UNLISTED";
  const linkLive = published || unlisted;
  const currentVisibility: EditorVisibility | null = video.status === "ARCHIVED" ? null : (video.status as EditorVisibility);
  const chosenVisibility: EditorVisibility = visibility ?? currentVisibility ?? "DRAFT";
  const visibilityLabel: Record<EditorVisibility, string> = {
    DRAFT: tx("Prywatny (szkic)", "Private (draft)"),
    UNLISTED: tx("Niepubliczny", "Unlisted"),
    PUBLISHED: tx("Publiczny", "Public"),
  };
  const visibilityHint: Record<EditorVisibility, string> = {
    DRAFT: tx("Widzisz go tylko Ty i osoby z kanału.", "Only you and your channel's members can see it."),
    UNLISTED: tx(
      "Każdy z linkiem obejrzy film, ale nie pojawi się na listach ani w wyszukiwarce.",
      "Anyone with the link can watch, but it does not appear in lists or search.",
    ),
    PUBLISHED: tx("Film jest widoczny na kanale, w wyszukiwarce i na listach.", "The video is visible on the channel, in search and in lists."),
  };
  const applyVisibility = () => {
    if (!currentVisibility || chosenVisibility === currentVisibility) return;
    if (
      chosenVisibility === "DRAFT" &&
      !window.confirm(
        tx(
          "Cofnąć publikację? Film przestanie być dostępny dla widzów i wróci do prywatnego szkicu.",
          "Unpublish this video? Viewers will no longer be able to watch it and it goes back to a private draft.",
        ),
      )
    )
      return;
    const success =
      chosenVisibility === "DRAFT"
        ? tx("Film jest prywatnym szkicem.", "The video is now a private draft.")
        : chosenVisibility === "UNLISTED"
          ? tx("Film jest niepubliczny: dostępny tylko z linkiem.", "The video is unlisted: available by link only.")
          : tx("Film opublikowany.", "Video published.");
    void run(
      () => studioApi(`${base}/publish`, { method: "POST", ...jsonBody({ action: visibilityAction(chosenVisibility) }) }),
      success,
      false,
    ).then(() => setVisibility(null));
  };
  const premiereDate = video.premiereAt ? new Date(video.premiereAt) : null;
  const premiereUpcoming = premiereDate !== null && premiereDate.getTime() > Date.now();

  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm({ ...form, [key]: value });

  return (
    <div className="grid gap-4">
      <div>
        <button type="button" className={ghostButtonClass} onClick={back}>
          {tx("← Wróć do filmów", "← Back to videos")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-4">
          <Card title={tx("Szczegóły", "Details")}>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (dirty && form.title.trim() && !busy) void save();
              }}
            >
              <Field label={tx("Tytuł (PL)", "Title (PL)")} htmlFor="ed-title" counter={<CharCounter id="ed-title-count" value={form.title} max={TITLE_MAX} />}>
                <input id="ed-title" className={inputClass} value={form.title} maxLength={TITLE_MAX} required aria-describedby="ed-title-count" onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label={tx("Tytuł (EN)", "Title (EN)")} htmlFor="ed-title-en" counter={<CharCounter id="ed-title-en-count" value={form.titleEn} max={TITLE_MAX} />}>
                <input id="ed-title-en" className={inputClass} value={form.titleEn} maxLength={TITLE_MAX} aria-describedby="ed-title-en-count" onChange={(e) => set("titleEn", e.target.value)} />
              </Field>
              <Field label={tx("Opis (PL)", "Description (PL)")} htmlFor="ed-desc" counter={<CharCounter id="ed-desc-count" value={form.description} max={DESCRIPTION_MAX} />}>
                <textarea id="ed-desc" className={inputClass} rows={5} maxLength={DESCRIPTION_MAX} value={form.description} aria-describedby="ed-desc-count" onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label={tx("Opis (EN)", "Description (EN)")} htmlFor="ed-desc-en" counter={<CharCounter id="ed-desc-en-count" value={form.descriptionEn} max={DESCRIPTION_MAX} />}>
                <textarea id="ed-desc-en" className={inputClass} rows={5} maxLength={DESCRIPTION_MAX} value={form.descriptionEn} aria-describedby="ed-desc-en-count" onChange={(e) => set("descriptionEn", e.target.value)} />
              </Field>
              <Field label={tx("Kto może oglądać", "Who can watch")} htmlFor="ed-tier">
                <select id="ed-tier" className={inputClass} value={form.tier} onChange={(e) => set("tier", e.target.value as EditorForm["tier"])}>
                  <option value="PUBLIC">{tx("Wszyscy", "Everyone")}</option>
                  <option value="LOGGED_IN">{tx("Tylko zalogowani", "Signed-in viewers only")}</option>
                </select>
              </Field>
              <label htmlFor="ed-adult" className="flex min-h-10 cursor-pointer items-start gap-3 rounded-xl border border-[var(--chan-line)] p-3">
                <input id="ed-adult" type="checkbox" checked={form.isAdult} className="mt-1 h-4 w-4" onChange={(e) => set("isAdult", e.target.checked)} />
                <span className="grid gap-0.5">
                  <span className="text-[14px] font-semibold text-[var(--chan-ink)]">{tx("Treści dla dorosłych (18+)", "Adult content (18+)")}</span>
                  <span className="text-[12px] text-[var(--chan-muted)]">
                    {tx("Film obejrzą tylko zalogowani widzowie i nie trafi do mapy strony.", "Only signed-in viewers can watch it, and it is left out of the sitemap.")}
                  </span>
                </span>
              </label>
              {!unlisted && (
                <Field
                  label={tx("Premiera (opcjonalnie)", "Premiere (optional)")}
                  htmlFor="ed-premiere"
                  hint={tx("Zostaw puste, aby opublikować od razu.", "Leave empty to publish at once.")}
                >
                  <input id="ed-premiere" type="datetime-local" className={inputClass} value={form.premiere} aria-describedby="ed-premiere-hint" onChange={(e) => set("premiere", e.target.value)} />
                </Field>
              )}
              <VideoMoreOptions
                idPrefix="ed"
                value={{ tags: form.tags, category: form.category, commentsMode: form.commentsMode }}
                onChange={(next) => setForm({ ...form, ...next })}
                disabled={busy}
              />
              <Field label={tx("Miniatura", "Thumbnail")} htmlFor="ed-cover" hint={tx("JPG, PNG lub WebP do 5 MB. Zapisuje się od razu.", "JPG, PNG or WebP up to 5 MB. Saved at once.")}>
                <input
                  id="ed-cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  className={inputClass}
                  aria-describedby="ed-cover-hint"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadCover(f);
                    e.target.value = "";
                  }}
                />
              </Field>
              {message && <Notice kind={message.kind}>{message.text}</Notice>}
              {dirty && <p className="text-[12px] font-semibold text-amber-700">{tx("Masz niezapisane zmiany.", "You have unsaved changes.")}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={buttonClass} disabled={busy || !dirty || !form.title.trim()}>
                  {tx("Zapisz", "Save")}
                </button>
                {video.status === "ARCHIVED" ? (
                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={busy || dirty}
                    title={dirty ? tx("Najpierw zapisz zmiany.", "Save your changes first.") : undefined}
                    onClick={() => {
                      if (!window.confirm(tx("Przywrócić film jako prywatny szkic?", "Restore this video as a private draft?"))) return;
                      void run(
                        () => studioApi(`${base}/publish`, { method: "POST", ...jsonBody({ action: "unpublish" }) }),
                        tx("Film przywrócony jako szkic.", "Video restored as a draft."),
                        false,
                      );
                    }}
                  >
                    {tx("Przywróć jako szkic", "Restore as draft")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={busy || dirty}
                    title={dirty ? tx("Najpierw zapisz zmiany.", "Save your changes first.") : undefined}
                    onClick={() =>
                      run(() => studioApi(`${base}/publish`, { method: "POST", ...jsonBody({ action: "archive" }) }), tx("Film zarchiwizowany.", "Video archived."), false)
                    }
                  >
                    {tx("Zarchiwizuj", "Archive")}
                  </button>
                )}
              </div>
            </form>
          </Card>

          {currentVisibility && (
            <Card title={tx("Widoczność", "Visibility")}>
              <div className="grid max-w-xl gap-3">
                <Field label={tx("Kto znajdzie ten film", "Who can find this video")} htmlFor="ed-visibility" hint={visibilityHint[chosenVisibility]}>
                  <select
                    id="ed-visibility"
                    className={inputClass}
                    value={chosenVisibility}
                    disabled={busy}
                    aria-describedby="ed-visibility-hint"
                    onChange={(e) => setVisibility(e.target.value as EditorVisibility)}
                  >
                    {(["DRAFT", "UNLISTED", "PUBLISHED"] as EditorVisibility[]).map((option) => (
                      <option key={option} value={option}>
                        {visibilityLabel[option]}
                      </option>
                    ))}
                  </select>
                </Field>
                {chosenVisibility !== "DRAFT" && !ready && currentVisibility === "DRAFT" && (
                  <p className="text-[12px] text-[var(--chan-muted)]">{tx("Film musi się najpierw przetworzyć.", "The video has to finish processing first.")}</p>
                )}
                <div>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || dirty || chosenVisibility === currentVisibility || (chosenVisibility !== "DRAFT" && currentVisibility === "DRAFT" && !ready)}
                    title={dirty ? tx("Najpierw zapisz zmiany.", "Save your changes first.") : undefined}
                    onClick={applyVisibility}
                  >
                    {tx("Zmień widoczność", "Change visibility")}
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Card title={tx("Usuń film", "Delete video")}>
            <div className="grid max-w-xl gap-3">
              <p className="text-[14px] text-[var(--chan-muted)]">
                {tx(
                  "Usunięcie jest ostateczne: znikają film, komentarze i pliki. Wpisz tytuł filmu, aby potwierdzić.",
                  "Deleting is final: the video, its comments and its files are removed. Type the video title to confirm.",
                )}
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

        <aside aria-label={tx("Podgląd filmu", "Video preview")} className="grid gap-4 lg:sticky lg:top-4">
          <Card>
            {/* The DTO's thumbnailUrl is already a public src (proxy path or public bucket URL). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={studioThumbnailSrc(video)}
              alt={tx("Miniatura filmu", "Video thumbnail")}
              className="aspect-video w-full rounded-xl bg-[var(--chan-surface)] object-cover"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={published ? "good" : "neutral"}>{statusLabel[video.status]}</Badge>
              {video.isAdult && <Badge tone="warn">18+</Badge>}
              <span className="text-[13px] text-[var(--chan-ink)]">{pipeline ? pipelineLabel[pipeline.summary] : tx("Sprawdzam…", "Checking…")}</span>
            </div>
            {pipeline?.job && pipeline.summary === "ENCODING" && (
              <div className="mt-3">
                <ProgressBar value={pipeline.job.progressPercent} />
              </div>
            )}
            {(pipeline?.summary === "FAILED" || pipeline?.summary === "UPLOAD_FAILED") && (
              <div className="mt-3">
                <Notice kind="error">
                  {pipeline.job?.failureReason ?? pipeline.original?.failureReason ?? tx("Spróbuj przesłać plik ponownie.", "Try uploading the file again.")}
                </Notice>
              </div>
            )}
            {video.publishAfterAssetReady && video.status === "DRAFT" && (
              <div className="mt-3 grid gap-2">
                <p className="text-[13px] text-[var(--chan-muted)]">
                  {tx("Ten film opublikuje się sam, gdy skończy się przetwarzanie.", "This video publishes itself when processing finishes.")}
                </p>
                <div>
                  <button
                    type="button"
                    className={smallGhostButtonClass}
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => studioApi(`${base}/publish`, { method: "POST", ...jsonBody({ action: "cancel_auto_publish" }) }),
                        tx("Automatyczna publikacja anulowana. Film zostaje szkicem.", "Automatic publication cancelled. The video stays a draft."),
                        false,
                      )
                    }
                  >
                    {tx("Anuluj automatyczną publikację", "Cancel automatic publication")}
                  </button>
                </div>
              </div>
            )}
            {premiereDate && premiereUpcoming && (
              <p className="mt-3 text-[13px] text-[var(--chan-muted)]">
                {tx("Premiera: {0}", "Premiere: {0}", premiereDate.toLocaleString(language))}
              </p>
            )}
            <p className="mt-3 text-[13px] text-[var(--chan-muted)]">{tx("{0} wyświetleń", "{0} views", video.views)}</p>
          </Card>

          <Card title={tx("Link do filmu", "Video link")}>
            {linkLive && watchUrl ? (
              <div className="grid gap-2">
                {unlisted && (
                  <p className="text-[12px] text-[var(--chan-muted)]">
                    {tx("Ten film jest niepubliczny: obejrzy go każdy, kto dostanie ten link.", "This video is unlisted: anyone who gets this link can watch it.")}
                  </p>
                )}
                <input readOnly value={watchUrl} aria-label={tx("Link do filmu", "Video link")} className={inputClass} onFocus={(e) => e.currentTarget.select()} />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={smallGhostButtonClass} onClick={copyLink}>
                    {tx("Kopiuj", "Copy")}
                  </button>
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-8 items-center rounded-lg px-2 text-[13px] font-semibold text-[var(--chan-ink)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]"
                  >
                    {tx("Otwórz film", "Open video")}
                  </a>
                  <span role="status" className="text-[12px] text-[var(--chan-muted)]">
                    {copied ? tx("Skopiowano.", "Copied.") : ""}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--chan-muted)]">{tx("Link pojawi się po opublikowaniu filmu.", "The link appears once the video is published.")}</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
