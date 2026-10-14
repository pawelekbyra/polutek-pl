"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { StudioApiError, jsonBody, studioApi, type StudioLimits } from "./studio-client";
import { uploadOriginal, type UploadProgress } from "./upload-original";
import { confirmLeave, setUnsavedWork } from "./unsaved-guard";
import { DESCRIPTION_MAX, TITLE_MAX, formatLimitDuration, titleFromFileName, validateCoverFile, visibilityToFields, type VisibilityMode } from "./video-form";
import VideoMoreOptions from "./VideoMoreOptions";
import type { VideoCommentsModeValue } from "@/lib/video-metadata";
import { Card, CharCounter, Field, Notice, ProgressBar, buttonClass, ghostButtonClass, inputClass } from "./ui";

type Step = 1 | 2 | 3;
type Phase = "idle" | "creating" | "uploading" | "error";
type Tier = "PUBLIC" | "LOGGED_IN";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

/**
 * Upload wizard: (1) file and details, (2) visibility, (3) sending. The draft is created when sending starts,
 * as a private draft, so closing the tab or cancelling halfway leaves a private draft and nothing public.
 */
export default function StudioUploadWizard({
  onCancel,
  onFinished,
  limits,
}: {
  onCancel: () => void;
  onFinished: (id: string) => void;
  /** The channel's limits (read only); the server enforces them, this only tells the creator up front. */
  limits?: StudioLimits | null;
}) {
  const { tx } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [mode, setMode] = useState<VisibilityMode>("private");
  const [premiere, setPremiere] = useState("");
  const [tier, setTier] = useState<Tier>("PUBLIC");
  const [isAdult, setIsAdult] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [commentsMode, setCommentsMode] = useState<VideoCommentsModeValue>("ON");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sending = phase === "creating" || phase === "uploading";

  // Work that would be lost on reload or navigation: a chosen file or typed text, and a running upload.
  useEffect(() => {
    setUnsavedWork(sending || (phase === "idle" && (file !== null || title !== "" || description !== "")));
  }, [sending, phase, file, title, description]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      setUnsavedWork(false);
    },
    [],
  );

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);

  const visibilityLabel: Record<VisibilityMode, string> = {
    private: tx("Prywatny (szkic)", "Private (draft)"),
    unlisted: tx("Niepubliczny", "Unlisted"),
    auto: tx("Publiczny (po przetworzeniu)", "Public (after processing)"),
    scheduled: tx("Zaplanowany", "Scheduled"),
  };

  const premiereMessage = (reason: "PREMIERE_REQUIRED" | "PREMIERE_INVALID" | "PREMIERE_PAST"): string => {
    if (reason === "PREMIERE_REQUIRED") return tx("Wybierz datę i godzinę publikacji.", "Choose the date and time of publication.");
    if (reason === "PREMIERE_PAST") return tx("Termin publikacji musi być w przyszłości.", "The publication time must be in the future.");
    return tx("Podaj poprawną datę i godzinę.", "Enter a valid date and time.");
  };

  const pickCover = (chosen: File | null) => {
    setCoverError(null);
    if (!chosen) {
      setCover(null);
      return;
    }
    const problem = validateCoverFile(chosen);
    if (problem) {
      setCover(null);
      setCoverError(
        problem === "TYPE"
          ? tx("Miniatura musi być plikiem JPG, PNG lub WebP.", "The thumbnail must be a JPG, PNG or WebP file.")
          : tx("Miniatura może mieć najwyżej 5 MB.", "The thumbnail can be at most 5 MB."),
      );
      return;
    }
    setCover(chosen);
  };

  const toStep2 = () => {
    if (!file || !title.trim()) return;
    setStep(2);
  };

  const start = async () => {
    if (!file) return;
    const visibility = visibilityToFields(mode, premiere, new Date());
    if (!visibility.ok) {
      setFieldError(premiereMessage(visibility.reason));
      return;
    }
    setFieldError(null);
    setError(null);
    setWarning(null);
    setStep(3);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let id = draftIdRef.current;
      if (!id) {
        setPhase("creating");
        const draft = await studioApi<{ id: string }>("/api/studio/videos", {
          method: "POST",
          ...jsonBody({
            title: title.trim() || titleFromFileName(file.name) || "Film",
            description: description.trim() || null,
            tier,
            tags,
            category: category || null,
            commentsMode,
            isAdult,
            publishAfterAssetReady: visibility.fields.publishAfterAssetReady,
            premiereAt: visibility.fields.premiereAt,
            ...(visibility.fields.publishAs ? { publishAs: visibility.fields.publishAs } : {}),
          }),
        });
        id = draft.id;
        draftIdRef.current = id;
        setDraftId(id);
        if (cover) {
          try {
            const body = new FormData();
            body.set("file", cover);
            await studioApi(`/api/studio/videos/${encodeURIComponent(id)}/cover`, { method: "POST", body });
          } catch {
            setWarning(
              tx(
                "Miniatura nie została zapisana. Dodasz ją w edycji filmu.",
                "The thumbnail was not saved. You can add it in the video editor.",
              ),
            );
          }
        }
      }
      setPhase("uploading");
      await uploadOriginal({
        videoId: id,
        file,
        fileName: file.name,
        contentType: file.type || undefined,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setUnsavedWork(false);
      onFinished(id);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof StudioApiError ? e.message : tx("Przesyłanie nie powiodło się. Spróbuj ponownie.", "Upload failed. Please try again."),
      );
      setPhase("error");
    }
  };

  const cancel = () => {
    if (sending) {
      const message = draftIdRef.current
        ? tx("Przerwać przesyłanie? Film zostanie zapisany jako prywatny szkic.", "Stop the upload? The video is kept as a private draft.")
        : tx("Przerwać przesyłanie?", "Stop the upload?");
      if (!confirmLeave(message)) return;
    } else if (!confirmLeave(tx("Porzucić wprowadzone dane?", "Discard what you entered?"))) {
      return;
    }
    abortRef.current?.abort();
    setUnsavedWork(false);
    onCancel();
  };

  const percent = progress && progress.totalBytes > 0 ? (progress.uploadedBytes / progress.totalBytes) * 100 : 0;
  const steps: { id: Step; label: string }[] = [
    { id: 1, label: tx("Szczegóły", "Details") },
    { id: 2, label: tx("Widoczność", "Visibility") },
    { id: 3, label: tx("Przesyłanie", "Upload") },
  ];

  return (
    <Card title={tx("Prześlij film", "Upload a video")}>
      <ol className="mb-5 flex flex-wrap gap-2" aria-label={tx("Kroki przesyłania", "Upload steps")}>
        {steps.map((s) => (
          <li
            key={s.id}
            aria-current={step === s.id ? "step" : undefined}
            className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
              step === s.id ? "bg-[var(--chan-ink)] text-[var(--chan-card)]" : "bg-[var(--chan-surface)] text-[var(--chan-muted)]"
            }`}
          >
            {tx("Krok {0}: {1}", "Step {0}: {1}", s.id, s.label)}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form
          className="grid max-w-2xl gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            toStep2();
          }}
        >
          <Field label={tx("Plik wideo", "Video file")} htmlFor="wz-file" hint={tx("MP4, MOV, MKV, WebM lub AVI.", "MP4, MOV, MKV, WebM or AVI.")}>
            <input
              id="wz-file"
              type="file"
              accept="video/*"
              aria-describedby="wz-file-hint"
              className={inputClass}
              onChange={(e) => {
                const chosen = e.target.files?.[0] ?? null;
                setFile(chosen);
                if (chosen && !title) setTitle(titleFromFileName(chosen.name));
              }}
            />
          </Field>
          {limits && (
            <p className="text-[13px] text-[var(--chan-muted)]">
              {tx(
                "Limit Twojego kanału: film do {0}, plik do {1}.",
                "Your channel limit: videos up to {0}, files up to {1}.",
                formatLimitDuration(limits.maxVideoSeconds),
                formatBytes(limits.maxUploadBytes),
              )}
            </p>
          )}
          {file && (
            <p className="text-[13px] text-[var(--chan-muted)]">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
          {file && limits && file.size > limits.maxUploadBytes && (
            <Notice kind="error">
              {tx("Ten plik jest większy niż limit Twojego kanału ({0}).", "This file is larger than your channel limit ({0}).", formatBytes(limits.maxUploadBytes))}
            </Notice>
          )}
          <Field label={tx("Tytuł", "Title")} htmlFor="wz-title" counter={<CharCounter id="wz-title-count" value={title} max={TITLE_MAX} />}>
            <input
              id="wz-title"
              className={inputClass}
              value={title}
              maxLength={TITLE_MAX}
              required
              aria-describedby="wz-title-count"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field
            label={tx("Opis", "Description")}
            htmlFor="wz-desc"
            hint={tx("Opcjonalny. Powie widzom, o czym jest film.", "Optional. Tells viewers what the video is about.")}
            counter={<CharCounter id="wz-desc-count" value={description} max={DESCRIPTION_MAX} />}
          >
            <textarea
              id="wz-desc"
              className={inputClass}
              rows={5}
              maxLength={DESCRIPTION_MAX}
              value={description}
              aria-describedby="wz-desc-hint wz-desc-count"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field
            label={tx("Miniatura (opcjonalnie)", "Thumbnail (optional)")}
            htmlFor="wz-cover"
            hint={tx("JPG, PNG lub WebP do 5 MB.", "JPG, PNG or WebP up to 5 MB.")}
          >
            <input
              id="wz-cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="wz-cover-hint"
              className={inputClass}
              onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
            />
          </Field>
          {coverError && <Notice kind="error">{coverError}</Notice>}
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt={tx("Podgląd miniatury", "Thumbnail preview")} className="aspect-video w-full max-w-xs rounded-xl bg-[var(--chan-surface)] object-cover" />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={buttonClass} disabled={!file || !title.trim()}>
              {tx("Dalej", "Next")}
            </button>
            <button type="button" className={ghostButtonClass} onClick={cancel}>
              {tx("Wróć", "Back")}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="grid max-w-2xl gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-[var(--chan-ink)]">{tx("Widoczność", "Visibility")}</legend>
            {(
              [
                ["private", tx("Film zostaje szkicem. Opublikujesz go sam, gdy będzie gotowy.", "The video stays a draft. You publish it yourself when it is ready.")],
                [
                  "unlisted",
                  tx(
                    "Każdy z linkiem obejrzy film po przetworzeniu, ale nie pojawi się na listach ani w wyszukiwarce.",
                    "Anyone with the link can watch after processing, but it does not appear in lists or search.",
                  ),
                ],
                ["auto", tx("Film pojawi się na kanale, gdy tylko skończy się przetwarzanie.", "The video goes live as soon as processing finishes.")],
                ["scheduled", tx("Film opublikuje się po przetworzeniu i będzie czekał do wybranego terminu.", "The video publishes after processing and waits for the chosen time.")],
              ] as [VisibilityMode, string][]
            ).map(([id, description]) => (
              <label
                key={id}
                htmlFor={`wz-vis-${id}`}
                className="flex min-h-10 cursor-pointer items-start gap-3 rounded-xl border border-[var(--chan-line)] p-3 has-[:checked]:border-[var(--chan-ink)]"
              >
                <input
                  id={`wz-vis-${id}`}
                  type="radio"
                  name="wz-visibility"
                  value={id}
                  checked={mode === id}
                  className="mt-1 h-4 w-4"
                  onChange={() => {
                    setMode(id);
                    setFieldError(null);
                  }}
                />
                <span className="grid gap-0.5">
                  <span className="text-[14px] font-semibold text-[var(--chan-ink)]">{visibilityLabel[id]}</span>
                  <span className="text-[12px] text-[var(--chan-muted)]">{description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {mode === "scheduled" && (
            <Field
              label={tx("Data i godzina publikacji", "Publication date and time")}
              htmlFor="wz-premiere"
              hint={timeZone ? tx("Strefa czasowa: {0}", "Time zone: {0}", timeZone) : undefined}
            >
              <input
                id="wz-premiere"
                type="datetime-local"
                className={inputClass}
                value={premiere}
                aria-describedby={timeZone ? "wz-premiere-hint" : undefined}
                onChange={(e) => {
                  setPremiere(e.target.value);
                  setFieldError(null);
                }}
              />
            </Field>
          )}
          <Field label={tx("Kto może oglądać", "Who can watch")} htmlFor="wz-tier">
            <select id="wz-tier" className={inputClass} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
              <option value="PUBLIC">{tx("Wszyscy", "Everyone")}</option>
              <option value="LOGGED_IN">{tx("Tylko zalogowani", "Signed-in viewers only")}</option>
            </select>
          </Field>
          <label htmlFor="wz-adult" className="flex min-h-10 cursor-pointer items-start gap-3 rounded-xl border border-[var(--chan-line)] p-3">
            <input id="wz-adult" type="checkbox" checked={isAdult} className="mt-1 h-4 w-4" onChange={(e) => setIsAdult(e.target.checked)} />
            <span className="grid gap-0.5">
              <span className="text-[14px] font-semibold text-[var(--chan-ink)]">{tx("Treści dla dorosłych (18+)", "Adult content (18+)")}</span>
              <span className="text-[12px] text-[var(--chan-muted)]">
                {tx("Film obejrzą tylko zalogowani widzowie i nie trafi do mapy strony.", "Only signed-in viewers can watch it, and it is left out of the sitemap.")}
              </span>
            </span>
          </label>
          <VideoMoreOptions
            idPrefix="wz"
            value={{ tags, category, commentsMode }}
            onChange={(next) => {
              setTags(next.tags);
              setCategory(next.category);
              setCommentsMode(next.commentsMode);
            }}
          />
          {fieldError && <Notice kind="error">{fieldError}</Notice>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={start}>
              {tx("Rozpocznij przesyłanie", "Start upload")}
            </button>
            <button type="button" className={ghostButtonClass} onClick={() => setStep(1)}>
              {tx("Wstecz", "Previous")}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid max-w-2xl gap-4">
          <dl className="grid gap-1 text-[14px]">
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-[var(--chan-ink)]">{tx("Tytuł", "Title")}:</dt>
              <dd className="text-[var(--chan-muted)]">{title.trim()}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-[var(--chan-ink)]">{tx("Widoczność", "Visibility")}:</dt>
              <dd className="text-[var(--chan-muted)]">{visibilityLabel[mode]}</dd>
            </div>
          </dl>
          <div className="grid gap-2" aria-live="polite">
            <ProgressBar value={percent} />
            <p className="text-[13px] text-[var(--chan-muted)]">
              {phase === "creating" && tx("Tworzę prywatny szkic…", "Creating a private draft…")}
              {phase === "uploading" && tx("Przesłano {0}%", "Uploaded {0}%", Math.round(percent))}
              {phase === "error" && tx("Przesyłanie zatrzymane.", "Upload stopped.")}
            </p>
          </div>
          {sending && (
            <p className="text-[12px] text-[var(--chan-muted)]">
              {tx(
                "Nie zamykaj tej karty. Jeśli przerwiesz, film zostanie prywatnym szkicem.",
                "Keep this tab open. If you stop, the video stays a private draft.",
              )}
            </p>
          )}
          {warning && <Notice>{warning}</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            {phase === "error" && (
              <button type="button" className={buttonClass} onClick={start}>
                {tx("Spróbuj ponownie", "Try again")}
              </button>
            )}
            {phase === "error" && draftId && (
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => {
                  setUnsavedWork(false);
                  onFinished(draftId);
                }}
              >
                {tx("Przejdź do szkicu", "Go to the draft")}
              </button>
            )}
            <button type="button" className={ghostButtonClass} onClick={cancel}>
              {sending ? tx("Przerwij", "Cancel") : tx("Wróć do filmów", "Back to videos")}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
