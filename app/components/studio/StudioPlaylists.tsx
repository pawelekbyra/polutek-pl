"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { countedNoun } from "@/lib/i18n/plurals";
import { getLocalizedHref } from "@/lib/i18n/routing";
import type { StudioPlaylistDto, StudioPlaylistSummaryDto } from "@/lib/modules/playlists/domain/playlist.dto";
import { moveItem } from "@/lib/modules/playlists/domain/playlist-rules";
import { jsonBody, studioApi } from "./studio-client";
import { Badge, Card, Notice, buttonClass, ghostButtonClass, smallButtonClass, smallDangerGhostButtonClass, smallGhostButtonClass } from "./ui";
import { PlaylistForm, errorText, useVisibilityText } from "./StudioPlaylistForm";
import StudioPlaylistPicker from "./StudioPlaylistPicker";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Studio -> Playlists: a creator's ordered lists of the channel's videos. List and create, edit title/description/
 * visibility, add videos with a search picker, reorder with up/down buttons (or Alt + arrow keys on a row), remove
 * and delete (our own confirm dialog). Everything goes through `/api/studio/playlists*`, which authorizes per channel.
 * A playlist is not the home sidebar (docs/architecture/playlists.md).
 */

type View = { kind: "list" } | { kind: "edit"; id: string };

export default function StudioPlaylists({ channelSlug }: { channelSlug: string }) {
  const [view, setView] = useState<View>({ kind: "list" });
  return view.kind === "list" ? (
    <PlaylistList channelSlug={channelSlug} onOpen={(id) => setView({ kind: "edit", id })} />
  ) : (
    <PlaylistEditor id={view.id} channelSlug={channelSlug} onBack={() => setView({ kind: "list" })} />
  );
}

function PlaylistList({ channelSlug, onOpen }: { channelSlug: string; onOpen: (id: string) => void }) {
  const { tx, language } = useLanguage();
  const visibility = useVisibilityText();
  const [items, setItems] = useState<StudioPlaylistSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await studioApi<{ items: StudioPlaylistSummaryDto[] }>("/api/studio/playlists")).items);
      setError(null);
    } catch (e) {
      setError(errorText(e, tx, tx("Nie udało się wczytać playlist.", "Could not load the playlists.")));
    }
  }, [tx]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4">
      <Card
        title={tx("Playlisty", "Playlists")}
        actions={
          !creating && (
            <button type="button" className={buttonClass} onClick={() => setCreating(true)}>
              {tx("Nowa playlista", "New playlist")}
            </button>
          )
        }
      >
        <p className="text-[14px] text-[var(--chan-muted)]">
          {tx("Playlisty to uporządkowane listy Twoich filmów. Widzowie odtwarzają je jeden po drugim.", "Playlists are ordered lists of your videos. Viewers play them one after another.")}
        </p>
        {creating && (
          <div className="mt-4">
            <PlaylistForm
              submitLabel={tx("Utwórz playlistę", "Create playlist")}
              busyLabel={tx("Tworzę…", "Creating…")}
              initial={{ title: "", description: "", visibility: "PUBLIC" }}
              onCancel={() => setCreating(false)}
              onSubmit={async (values) => {
                const created = await studioApi<StudioPlaylistSummaryDto>("/api/studio/playlists", { method: "POST", ...jsonBody(values) });
                setCreating(false);
                onOpen(created.id);
              }}
            />
          </div>
        )}
      </Card>

      {error && <Notice kind="error">{error}</Notice>}
      {items && items.length === 0 && !creating && (
        <Notice>{tx("Nie masz jeszcze playlist. Utwórz pierwszą.", "You have no playlists yet. Create your first one.")}</Notice>
      )}
      {items && items.length > 0 && (
        <ul className="grid gap-2">
          {items.map((playlist) => (
            <li key={playlist.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-3 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-[var(--chan-ink)]">{playlist.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--chan-muted)]">
                  <Badge tone={playlist.visibility === "PUBLIC" ? "good" : "neutral"}>{visibility.label[playlist.visibility]}</Badge>
                  <span>
                    {playlist.itemCount} {countedNoun(language, "videos", playlist.itemCount)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {playlist.visibility !== "PRIVATE" && (
                  <a
                    className={smallGhostButtonClass}
                    href={getLocalizedHref(language, "playlist", { channel: channelSlug, slug: playlist.slug })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tx("Otwórz stronę playlisty", "Open playlist page")}
                  </a>
                )}
                <button type="button" className={smallButtonClass} onClick={() => onOpen(playlist.id)}>
                  {tx("Edytuj", "Edit")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!items && !error && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>}
    </div>
  );
}

function PlaylistEditor({ id, channelSlug, onBack }: { id: string; channelSlug: string; onBack: () => void }) {
  const { tx, language } = useLanguage();
  const [playlist, setPlaylist] = useState<StudioPlaylistDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // After a move the row keeps the keyboard focus (the list re-renders in the new order).
  const [focusVideoId, setFocusVideoId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const load = useCallback(async () => {
    try {
      setPlaylist(await studioApi<StudioPlaylistDto>(`/api/studio/playlists/${encodeURIComponent(id)}`));
      setError(null);
    } catch (e) {
      setError(errorText(e, tx, tx("Nie udało się wczytać playlisty.", "Could not load the playlist.")));
    }
  }, [id, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusVideoId) return;
    rowRefs.current.get(focusVideoId)?.focus();
    setFocusVideoId(null);
  }, [focusVideoId, playlist]);

  const move = async (videoId: string, delta: number) => {
    if (!playlist || saving) return;
    const from = playlist.items.findIndex((item) => item.videoId === videoId);
    const next = moveItem(playlist.items, from, delta);
    if (next.every((item, index) => item === playlist.items[index])) return;
    const previous = playlist;
    setPlaylist({ ...playlist, items: next });
    setFocusVideoId(videoId);
    setSaving(true);
    setNotice(null);
    try {
      await studioApi(`/api/studio/playlists/${encodeURIComponent(id)}/order`, { method: "PUT", ...jsonBody({ videoIds: next.map((item) => item.videoId) }) });
      setNotice(tx("Kolejność zapisana.", "Order saved."));
    } catch (e) {
      setPlaylist(previous);
      setError(errorText(e, tx, tx("Nie udało się zapisać kolejności.", "Could not save the order.")));
      void load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (videoId: string) => {
    setSaving(true);
    setNotice(null);
    try {
      await studioApi(`/api/studio/playlists/${encodeURIComponent(id)}/items`, { method: "DELETE", ...jsonBody({ videoId }) });
      setError(null);
      await load();
    } catch (e) {
      setError(errorText(e, tx, tx("Nie udało się usunąć filmu z playlisty.", "Could not remove the video from the playlist.")));
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    setDeleting(true);
    try {
      await studioApi(`/api/studio/playlists/${encodeURIComponent(id)}`, { method: "DELETE" });
      onBack();
    } catch (e) {
      setConfirmDelete(false);
      setError(errorText(e, tx, tx("Nie udało się usunąć playlisty.", "Could not delete the playlist.")));
    } finally {
      setDeleting(false);
    }
  };

  if (error && !playlist) {
    return (
      <div className="grid gap-3">
        <Notice kind="error">{error}</Notice>
        <div>
          <button type="button" className={ghostButtonClass} onClick={onBack}>
            {tx("Wróć do playlist", "Back to playlists")}
          </button>
        </div>
      </div>
    );
  }
  if (!playlist) return <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>;

  const heldBack = playlist.items.filter((item) => !item.visibleToPublic).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={ghostButtonClass} onClick={onBack}>
          {tx("Wróć do playlist", "Back to playlists")}
        </button>
        <div className="flex flex-wrap gap-2">
          {playlist.visibility !== "PRIVATE" && (
            <a className={ghostButtonClass} href={getLocalizedHref(language, "playlist", { channel: channelSlug, slug: playlist.slug })} target="_blank" rel="noreferrer">
              {tx("Otwórz stronę playlisty", "Open playlist page")}
            </a>
          )}
          <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-300 bg-[var(--chan-card)] px-4 py-2 text-[14px] font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]" onClick={() => setConfirmDelete(true)}>
            {tx("Usuń playlistę", "Delete playlist")}
          </button>
        </div>
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      <Card title={tx("Szczegóły", "Details")}>
        <PlaylistForm
          initial={{ title: playlist.title, description: playlist.description ?? "", visibility: playlist.visibility }}
          submitLabel={tx("Zapisz zmiany", "Save changes")}
          busyLabel={tx("Zapisuję…", "Saving…")}
          onSubmit={async (values) => {
            const updated = await studioApi<StudioPlaylistSummaryDto>(`/api/studio/playlists/${encodeURIComponent(id)}`, { method: "PATCH", ...jsonBody(values) });
            setPlaylist((current) => (current ? { ...current, ...updated } : current));
          }}
        />
      </Card>

      <Card title={tx("Filmy na playliście", "Videos in this playlist")}>
        {playlist.items.length === 0 ? (
          <p className="text-[14px] text-[var(--chan-muted)]">{tx("Ta playlista jest pusta. Dodaj pierwszy film.", "This playlist is empty. Add the first video.")}</p>
        ) : (
          <>
            {heldBack > 0 && (
              <div className="mb-3">
                <Notice>{tx("Część filmów nie jest jeszcze widoczna dla widzów (szkic, film niepubliczny, premiera albo 18+ dla niezalogowanych).", "Some videos are not visible to viewers yet (draft, unlisted video, upcoming premiere, or 18+ for signed-out viewers).")}</Notice>
              </div>
            )}
            <p className="mb-2 text-[12px] text-[var(--chan-muted)]">{tx("Kolejność zmienisz przyciskami albo klawiszami Alt + strzałka w górę lub w dół na wybranym filmie.", "Change the order with the buttons or with Alt + arrow up or down on a focused video.")}</p>
            <ol className="grid gap-2" aria-label={tx("Filmy na playliście", "Videos in this playlist")}>
              {playlist.items.map((item, index) => (
                <li
                  key={item.videoId}
                  ref={(node) => {
                    if (node) rowRefs.current.set(item.videoId, node);
                    else rowRefs.current.delete(item.videoId);
                  }}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                    event.preventDefault();
                    void move(item.videoId, event.key === "ArrowUp" ? -1 : 1);
                  }}
                  aria-label={tx("{0}, pozycja {1} z {2}", "{0}, position {1} of {2}", item.title, index + 1, playlist.items.length)}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--chan-line)] p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] sm:flex-nowrap"
                >
                  <span className="w-6 shrink-0 text-center text-[13px] tabular-nums text-[var(--chan-muted)]">{index + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbnailUrl} alt="" width={96} height={54} loading="lazy" className="h-[40px] w-[72px] shrink-0 rounded-lg bg-[var(--chan-surface)] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--chan-ink)]">{item.title}</p>
                    {!item.visibleToPublic && <p className="text-[12px] text-amber-700">{tx("Niewidoczny dla widzów", "Not visible to viewers")}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className={smallGhostButtonClass} disabled={saving || index === 0} aria-label={`${tx("Przesuń w górę", "Move up")}: ${item.title}`} onClick={() => void move(item.videoId, -1)}>
                      <span aria-hidden="true">{"↑"}</span>
                    </button>
                    <button type="button" className={smallGhostButtonClass} disabled={saving || index === playlist.items.length - 1} aria-label={`${tx("Przesuń w dół", "Move down")}: ${item.title}`} onClick={() => void move(item.videoId, 1)}>
                      <span aria-hidden="true">{"↓"}</span>
                    </button>
                    <button type="button" className={smallDangerGhostButtonClass} disabled={saving} aria-label={`${tx("Usuń", "Remove")}: ${item.title}`} onClick={() => void remove(item.videoId)}>
                      {tx("Usuń", "Remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[12px] text-[var(--chan-muted)]">
          {notice}
        </p>
      </Card>

      <StudioPlaylistPicker playlistId={id} present={new Set(playlist.items.map((item) => item.videoId))} onAdded={load} onError={setError} />

      {confirmDelete && (
        <ConfirmDialog
          title={tx("Usunąć playlistę?", "Delete this playlist?")}
          confirmLabel={tx("Usuń playlistę", "Delete playlist")}
          cancelLabel={tx("Anuluj", "Cancel")}
          danger
          busy={deleting}
          onConfirm={() => void destroy()}
          onCancel={() => setConfirmDelete(false)}
        >
          {tx("Playlista “{0}” zniknie dla widzów. Same filmy zostaną na kanale.", "The playlist “{0}” will disappear for viewers. The videos themselves stay on your channel.", playlist.title)}
        </ConfirmDialog>
      )}
    </div>
  );
}

