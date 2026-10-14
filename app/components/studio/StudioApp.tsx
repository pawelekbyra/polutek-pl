"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { StudioApiError, jsonBody, studioApi, studioThumbnailSrc, type StudioCommentList, type StudioMe, type StudioVideo, type StudioVideoList } from "./studio-client";
import { Badge, Card, Field, Notice, buttonClass, focusRingClass, ghostButtonClass, inputClass } from "./ui";
import { confirmLeave } from "./unsaved-guard";
import StudioContent, { type ContentView } from "./StudioContent";
import StudioComments from "./StudioComments";
import StudioProfile from "./StudioProfile";

type SectionId = "overview" | "content" | "comments" | "profile";

const SECTION_IDS: SectionId[] = ["overview", "content", "comments", "profile"];

function readSection(): SectionId {
  if (typeof window === "undefined") return "overview";
  const raw = new URLSearchParams(window.location.search).get("section");
  return SECTION_IDS.includes(raw as SectionId) ? (raw as SectionId) : "overview";
}

/**
 * The creator Studio (/studio): one page, four sections. All data comes from `/api/studio/*`, which acts as the
 * signed-in user and authorizes every call per channel (CLAUDE.md 4.23). A user without a channel sees the
 * "create channel" form (or a note that creation is closed).
 */
export default function StudioApp() {
  const { tx } = useLanguage();
  const [me, setMe] = useState<StudioMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("overview");
  // Where the Content section should open when the dashboard sends the creator straight to a video or the wizard.
  const [contentIntent, setContentIntent] = useState<ContentView | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setMe(await studioApi<StudioMe>("/api/studio/me"));
      setError(null);
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : tx("Nie udało się wczytać Studia.", "Could not load the Studio."));
    }
  }, [tx]);

  useEffect(() => {
    setSection(readSection());
    void load();
  }, [load]);

  const go = (next: SectionId, intent?: ContentView) => {
    if (next !== section) {
      const message = tx("Masz niezapisane zmiany lub trwa przesyłanie. Wyjść z tej sekcji?", "You have unsaved changes or an upload in progress. Leave this section?");
      if (!confirmLeave(message)) return;
    }
    setContentIntent(next === "content" ? intent : undefined);
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState(null, "", url);
  };

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!me) return <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję Studio…", "Loading the Studio…")}</p>;
  if (!me.channel) return <CreateChannel mode={me.channelCreation} onCreated={load} />;

  const labels: Record<SectionId, string> = {
    overview: tx("Panel", "Dashboard"),
    content: tx("Treści", "Content"),
    comments: tx("Komentarze", "Comments"),
    profile: tx("Kanał i ustawienia", "Channel and settings"),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label={tx("Sekcje Studia", "Studio sections")} className="flex gap-1 overflow-x-auto lg:flex-col">
        {SECTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            aria-current={section === id ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-[14px] font-semibold transition ${focusRingClass} ${
              section === id ? "bg-[var(--chan-ink)] text-[var(--chan-card)]" : "text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]"
            }`}
          >
            {labels[id]}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {me.channel.status === "PENDING_REVIEW" && (
          <div className="mb-4">
            <Notice>
              {tx(
                "Twój kanał czeka na zatwierdzenie przez zespół platformy. Możesz już przygotowywać filmy, ale kanał nie jest jeszcze publiczny.",
                "Your channel is waiting for approval by the platform team. You can prepare videos, but the channel is not public yet.",
              )}
            </Notice>
          </div>
        )}
        {me.channel.status === "LIMITED" && (
          <div className="mb-4">
            <Notice kind="error">
              {tx(
                "Platforma ograniczyła możliwości Twojego kanału (np. dodawanie nowych filmów).",
                "The platform has limited your channel (for example, adding new videos).",
              )}
            </Notice>
          </div>
        )}
        {section === "overview" && <Overview me={me} onOpen={go} />}
        {section === "content" && <StudioContent initialView={contentIntent} />}
        {section === "comments" && <StudioComments />}
        {section === "profile" && <StudioProfile channel={me.channel} onChanged={load} />}
      </div>
    </div>
  );
}

function Overview({ me, onOpen }: { me: StudioMe; onOpen: (s: SectionId, intent?: ContentView) => void }) {
  const { tx, language } = useLanguage();
  const channel = me.channel!;
  // What the dashboard shows comes from the same Studio API as the sections; a failed request just hides its card.
  const [lastVideo, setLastVideo] = useState<StudioVideo | null | undefined>(undefined);
  const [videoTotal, setVideoTotal] = useState<number | null>(null);
  const [toReview, setToReview] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    studioApi<StudioVideoList>("/api/studio/videos?limit=1")
      .then((data) => {
        if (cancelled) return;
        setLastVideo(data.items[0] ?? null);
        setVideoTotal(data.total);
      })
      .catch(() => undefined);
    studioApi<StudioCommentList>("/api/studio/comments?status=HELD_FOR_REVIEW")
      .then((data) => !cancelled && setToReview(data.counts?.held ?? data.total))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel: Record<string, string> = {
    ACTIVE: tx("Aktywny", "Active"),
    PENDING_REVIEW: tx("Czeka na zatwierdzenie", "Pending review"),
    LIMITED: tx("Ograniczony", "Limited"),
    SUSPENDED: tx("Zawieszony", "Suspended"),
    BANNED: tx("Zablokowany", "Banned"),
  };
  const videoStatusLabel: Record<StudioVideo["status"], string> = {
    DRAFT: tx("Szkic", "Draft"),
    PUBLISHED: tx("Opublikowany", "Published"),
    UNLISTED: tx("Niepubliczny", "Unlisted"),
    ARCHIVED: tx("Zarchiwizowany", "Archived"),
  };

  return (
    <div className="grid gap-4">
      <Card title={channel.name}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={channel.status === "ACTIVE" ? "good" : "warn"}>{statusLabel[channel.status] ?? channel.status}</Badge>
          {channel.handle && <span className="text-[14px] text-[var(--chan-muted)]">@{channel.handle}</span>}
        </div>
        <p className="mt-3 text-[14px] text-[var(--chan-muted)]">
          {tx(
            "Tu dodajesz filmy, odpowiadasz na komentarze i zmieniasz wygląd kanału.",
            "Here you add videos, answer comments and change how your channel looks.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => onOpen("content", { kind: "upload" })}>
            {tx("Prześlij film", "Upload a video")}
          </button>
          <button type="button" className={ghostButtonClass} onClick={() => onOpen("comments")}>
            {tx("Komentarze", "Comments")}
          </button>
          <button type="button" className={ghostButtonClass} onClick={() => onOpen("profile")}>
            {tx("Zmień nazwę i uchwyt", "Change name and handle")}
          </button>
        </div>
      </Card>

      {videoTotal === 0 && (
        <Card title={tx("Zacznij od pierwszego filmu", "Start with your first video")}>
          <ol className="grid list-decimal gap-1 pl-5 text-[14px] text-[var(--chan-ink)]">
            <li>{tx("Wybierz plik wideo i nadaj mu tytuł oraz opis.", "Choose a video file and give it a title and description.")}</li>
            <li>{tx("Zdecyduj, czy film ma być prywatny, opublikowany od razu, czy zaplanowany.", "Decide whether the video stays private, goes live at once or is scheduled.")}</li>
            <li>{tx("Poczekaj na przetworzenie i opublikuj.", "Wait for processing, then publish.")}</li>
          </ol>
          <div className="mt-4">
            <button type="button" className={buttonClass} onClick={() => onOpen("content", { kind: "upload" })}>
              {tx("Prześlij pierwszy film", "Upload your first video")}
            </button>
          </div>
        </Card>
      )}

      {lastVideo && (
        <Card title={tx("Ostatni film", "Latest video")}>
          <div className="flex flex-wrap items-center gap-3">
            {/* The list DTO's thumbnailUrl is already a public src (proxy path or public bucket URL). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={studioThumbnailSrc(lastVideo)}
              alt=""
              width={160}
              height={90}
              className="h-[54px] w-24 shrink-0 rounded-none bg-[var(--chan-surface)] object-cover sm:h-[72px] sm:w-32"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[var(--chan-ink)]">{lastVideo.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--chan-muted)]">
                <Badge tone={lastVideo.status === "PUBLISHED" ? "good" : "neutral"}>{videoStatusLabel[lastVideo.status]}</Badge>
                <span>{tx("{0} wyświetleń", "{0} views", lastVideo.views)}</span>
                <span>{tx("Dodano {0}", "Added {0}", new Date(lastVideo.createdAt).toLocaleDateString(language))}</span>
              </p>
            </div>
            <button type="button" className={ghostButtonClass} onClick={() => onOpen("content", { kind: "edit", id: lastVideo.id })}>
              {tx("Edytuj", "Edit")}
            </button>
          </div>
        </Card>
      )}

      {toReview !== null && (
        <Card title={tx("Komentarze do przejrzenia", "Comments to review")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-[var(--chan-ink)]">
              {toReview > 0
                ? tx("Do przejrzenia: {0}", "Waiting for review: {0}", toReview)
                : tx("Brak komentarzy czekających na przegląd.", "No comments are waiting for review.")}
            </p>
            {toReview > 0 && (
              <button type="button" className={ghostButtonClass} onClick={() => onOpen("comments")}>
                {tx("Przejrzyj komentarze", "Review comments")}
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function CreateChannel({ mode, onCreated }: { mode: StudioMe["channelCreation"]; onCreated: () => void }) {
  const { tx } = useLanguage();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const value = handle.trim();
    if (value.length < 3) {
      setHint(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await studioApi<{ available: boolean; reason?: string; suggestions?: string[] }>(
          `/api/studio/channel/handle?handle=${encodeURIComponent(value)}`,
        );
        if (result.available) setHint(tx("Uchwyt jest wolny.", "This handle is available."));
        else
          setHint(
            `${result.reason ?? ""}${result.suggestions?.length ? ` ${tx("Propozycje:", "Suggestions:")} ${result.suggestions.map((s) => "@" + s).join(", ")}` : ""}`,
          );
      } catch {
        setHint(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [handle, tx]);

  if (mode === "off") {
    return (
      <Card title={tx("Kanały twórców", "Creator channels")}>
        <p className="text-[14px] text-[var(--chan-muted)]">
          {tx(
            "Zakładanie kanałów nie jest jeszcze otwarte. Wróć tu wkrótce.",
            "Creating channels is not open yet. Please check back soon.",
          )}
        </p>
      </Card>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await studioApi("/api/studio/channel", { method: "POST", ...jsonBody({ name, handle }) });
      onCreated();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof StudioApiError ? e.message : tx("Nie udało się założyć kanału.", "Could not create the channel.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={tx("Załóż kanał", "Create your channel")}>
      <form onSubmit={submit} className="grid max-w-xl gap-4">
        <Field label={tx("Nazwa kanału", "Channel name")} htmlFor="studio-name">
          <input id="studio-name" className={inputClass} value={name} maxLength={50} required onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label={tx("Uchwyt", "Handle")}
          htmlFor="studio-handle"
          hint={hint ?? tx("3–30 znaków: małe litery, cyfry oraz . _ -", "3–30 characters: lowercase letters, digits and . _ -")}
        >
          <input
            id="studio-handle"
            className={inputClass}
            value={handle}
            maxLength={30}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setHandle(e.target.value)}
          />
        </Field>
        {mode === "invite" && (
          <Notice>
            {tx("Zakładanie kanałów jest na razie tylko na zaproszenie.", "Creating channels is invitation only for now.")}
          </Notice>
        )}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <div>
          <button type="submit" className={buttonClass} disabled={busy || name.trim().length === 0 || handle.trim().length < 3}>
            {busy ? tx("Zakładam…", "Creating…") : tx("Załóż kanał", "Create channel")}
          </button>
        </div>
      </form>
    </Card>
  );
}
