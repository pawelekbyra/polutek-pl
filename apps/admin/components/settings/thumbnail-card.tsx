"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeDefaultThumbnailAction } from "@admin/app/(panel)/ustawienia/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { FilePick, postFile } from "@admin/components/content/media-cards";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function DefaultThumbnailCard({ hasImage, version, creatorOverride }: { hasImage: boolean; version: string; creatorOverride: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const upload = async (file: File) => {
    if (busy) return;
    if (file.size > 5 * 1024 * 1024) return setError("Miniatura może mieć najwyżej 5 MB.");
    setBusy(true);
    setError(null);
    const res = await postFile("/api/settings/default-thumbnail", file);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    toast("ok", "Domyślna miniatura zapisana", "Nowy plik jest już zapisany; stary został usunięty dopiero po zapisie.");
    router.refresh();
  };
  const remove = () =>
    start(async () => {
      const res = await removeDefaultThumbnailAction();
      if (!res.ok) return setError(res.message);
      setConfirm(false);
      toast("ok", res.message ?? "Usunięto");
      router.refresh();
    });

  return (
    <section className="card" aria-labelledby="h-dth">
      <div className="card-head">
        <h2 id="h-dth">Domyślna miniatura</h2>
        <p className="sub">Dla filmów bez własnej miniatury.</p>
      </div>
      {creatorOverride ? (
        <div className="banner warn mb-3" role="status">
          <Icon name="warn" />
          <div className="banner-body">
            <span className="banner-title">Stary adres URL z dawnego panelu przesłania wgrany plik</span>
            <span className="text-2">Zapisanie albo usunięcie miniatury tutaj czyści ten adres.</span>
          </div>
        </div>
      ) : null}
      <div className="preview preview-narrow">
        <div className="frame">
          {/* eslint-disable-next-line @next/next/no-img-element -- panel preview route */}
          <img src={`/api/settings/default-thumbnail?v=${encodeURIComponent(version)}`} alt={hasImage ? "Obecna domyślna miniatura" : "Brak domyślnej miniatury"} />
          <span>{hasImage ? "" : "brak"}</span>
        </div>
        Kadr 16:9
      </div>
      {error ? (
        <p className="form-error mt-3" role="alert">
          <Icon name="crit" />
          {error}
        </p>
      ) : null}
      <div className="card-foot">
        <span className="muted">JPG, PNG albo WebP do 5 MB, prywatny bucket R2. Nowa wersja zapisuje się przed usunięciem starej.</span>
        <div className="row">
          {hasImage ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setError(null); setConfirm(true); }}>
              Usuń
            </button>
          ) : null}
          <FilePick accept="image/jpeg,image/png,image/webp" label={hasImage ? "Podmień" : "Wgraj"} busy={busy} onFile={upload} />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        options={{ title: "Usunąć domyślną miniaturę?", confirm: "Usuń", danger: true, effect: ["filmy bez własnej miniatury pokażą neutralny obraz", "plik zostanie skasowany z R2", "wpis DEFAULT_THUMBNAIL_DELETED w audycie"] }}
        busy={pending}
        error={error}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}
