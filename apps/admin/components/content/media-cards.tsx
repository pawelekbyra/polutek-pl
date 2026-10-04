"use client";
/** Cover and subtitle files of a film: picked, checked a little in the browser, really checked on the server. */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removeSubtitleAction } from "@admin/app/(panel)/tresci/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

async function postFile(url: string, file: File): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch(url, { method: "POST", body: fd }).catch(() => null);
  if (!res) return { ok: false, message: "Brak połączenia z panelem. Spróbuj ponownie." };
  const body = (await res.json().catch(() => null)) as { error?: string } | Record<string, unknown> | null;
  if (!res.ok) return { ok: false, message: (body as { error?: string } | null)?.error ?? `Błąd serwera (HTTP ${res.status}).` };
  return { ok: true, data: (body ?? {}) as Record<string, unknown> };
}

function FilePick({ accept, label, busy, onFile }: { accept: string; label: string; busy: boolean; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} aria-disabled={busy}>
        <Icon name="upload" />
        {busy ? "Wgrywam…" : label}
      </button>
    </>
  );
}

export function CoverUpload({ videoId, title, src }: { videoId: string; title: string; src: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    if (busy) return;
    if (file.size > 5 * 1024 * 1024) return setError("Miniatura może mieć najwyżej 5 MB.");
    setBusy(true);
    setError(null);
    const res = await postFile(`/api/videos/${encodeURIComponent(videoId)}/cover`, file);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    toast("ok", "Nowa miniatura zapisana", "Kopia publiczna powstaje przy publikacji albo od razu, jeśli film jest opublikowany.");
    router.refresh();
  };
  return (
    <section className="card" id="miniatura" aria-labelledby="h-th">
      <div className="card-head">
        <h2 id="h-th">Miniatura</h2>
      </div>
      <div className="preview">
        <div className="frame">
          {/* eslint-disable-next-line @next/next/no-img-element -- panel preview route */}
          <img src={src} alt={`Obecna miniatura filmu ${title}`} />
          <span>{title}</span>
        </div>
        Kadr 16:9, tak jak w kaflu i w Hero
      </div>
      {error ? (
        <p className="form-error mt-3" role="alert">
          <Icon name="crit" />
          {error}
        </p>
      ) : null}
      <div className="card-foot">
        <span className="muted">JPG, PNG albo WebP do 5 MB, kadr 16:9. Serwer sprawdza nagłówek pliku.</span>
        <FilePick accept="image/jpeg,image/png,image/webp" label="Wgraj nową" busy={busy} onFile={upload} />
      </div>
    </section>
  );
}

export function SubtitlesCard({ videoId, slug, pl, en }: { videoId: string; slug: string; pl: string | null; en: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"pl" | "en" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<"pl" | "en" | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = async (lang: "pl" | "en", file: File) => {
    if (busy) return;
    if (file.size > 1024 * 1024) return setError("Plik napisów może mieć najwyżej 1 MB.");
    setBusy(lang);
    setError(null);
    const res = await postFile(`/api/videos/${encodeURIComponent(videoId)}/subtitles/${lang}`, file);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    toast("ok", `Napisy ${lang.toUpperCase()} zapisane`, `${res.data.cues ?? "?"} napisów, WebVTT poprawny.`);
    router.refresh();
  };

  const rows = [
    ["pl", "Polski", pl],
    ["en", "Angielski", en],
  ] as const;
  return (
    <section className="card" id="napisy" aria-labelledby="h-sub">
      <div className="card-head">
        <h2 id="h-sub">Napisy</h2>
        <p className="sub">Plik WebVTT (.vtt) do 1 MB. Serwer sprawdza nagłówek WEBVTT i znaczniki czasu; odtwarzacz pokazuje przycisk CC.</p>
      </div>
      <ul className="list">
        {rows.map(([lang, name, url]) => (
          <li key={lang}>
            <span className="li-icon">
              <Icon name="subtitles" />
            </span>
            <div className="li-main">
              <span className="li-title">{name}</span>
              <span className="li-sub">{url ? "WebVTT, jest" : "brak pliku"}</span>
            </div>
            <div className="li-actions">
              {url ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setRemoveError(null); setRemove(lang); }}>
                  Usuń
                </button>
              ) : null}
              <FilePick accept=".vtt,text/vtt" label={url ? "Podmień" : "Wgraj VTT"} busy={busy === lang} onFile={(f) => upload(lang, f)} />
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="form-error mt-3" role="alert">
          <Icon name="crit" />
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={!!remove}
        options={remove ? { title: `Usunąć napisy ${remove.toUpperCase()}?`, confirm: "Usuń napisy", danger: true, effect: ["odtwarzacz przestaje pokazywać ten język", "plik znika z publicznego hosta", "wpis VIDEO_SUBTITLES_REMOVED w audycie"] } : null}
        busy={pending}
        error={removeError}
        onClose={() => setRemove(null)}
        onConfirm={() =>
          remove &&
          start(async () => {
            const res = await removeSubtitleAction({ videoId, lang: remove, slug });
            if (!res.ok) return setRemoveError(res.message);
            setRemove(null);
            toast("ok", res.message ?? "Napisy usunięte");
            router.refresh();
          })
        }
      />
    </section>
  );
}
