"use client";
/**
 * Archive / restore and delete for good. Delete = type the film's address + a fresh step-up (passkey or
 * TOTP in the last 5 minutes, owner decision 2026-10-04); without it the owner is sent to /potwierdz first.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteFilmAction, filmStatusAction } from "@admin/app/(panel)/tresci/actions";
import { ConfirmDialog, type ConfirmOptions } from "@admin/components/confirm-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function DangerZone({ id, slug, title, archived }: { id: string; slug: string; title: string; archived: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState<"archive" | "restore" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const returnTo = `/tresci/${slug}/edycja#usun`;

  const options: Record<"archive" | "restore" | "delete", ConfirmOptions> = {
    archive: { title: `Archiwizować „${title}”?`, confirm: "Archiwizuj", body: "Film zniknie ze strony i z list. Możesz go przywrócić.", effect: ["znika z listy filmów i z Hero", "publiczna miniatura usunięta", "komentarze i statystyki zostają"] },
    restore: { title: `Przywrócić „${title}” do szkiców?`, confirm: "Przywróć", effect: ["film wraca jako szkic, niewidoczny na stronie"] },
    delete: {
      title: `Usunąć „${title}” na zawsze?`,
      confirm: "Usuń film",
      danger: true,
      body: "Tego nie da się cofnąć. Jeśli chcesz tylko schować film, użyj „Archiwizuj”. Wymaga potwierdzenia tożsamości z ostatnich 5 minut.",
      effect: ["film, komentarze i statystyki znikają z bazy", "oryginał, wersje HLS i napisy są kasowane z R2", "trwające kodowanie przerywa się", "wpis VIDEO_DELETED w audycie"],
      typed: { label: "Wpisz adres filmu", expect: slug },
    },
  };

  const confirm = (typed: string) =>
    start(async () => {
      if (open === "delete") {
        // The action redirects to /tresci on success; it only returns on refusal.
        const res = await deleteFilmAction({ id, typedSlug: typed, returnTo });
        if (res && !res.ok) {
          if (res.code === "STEP_UP_REQUIRED") {
            router.push(`/potwierdz?next=${encodeURIComponent(returnTo)}`);
            return;
          }
          setError(res.message);
        }
        return;
      }
      if (!open) return;
      const res = await filmStatusAction({ id, op: open });
      if (!res.ok) return setError(res.message);
      setOpen(null);
      toast("ok", res.message ?? "Zapisano");
      router.refresh();
    });

  return (
    <section className="card" id="usun" aria-labelledby="h-danger">
      <div className="card-head">
        <h2 id="h-danger">Strefa zagrożenia</h2>
      </div>
      <ul className="list danger-list">
        <li>
          <div className="li-main">
            <span className="li-title">{archived ? "Przywróć do szkiców" : "Archiwizuj"}</span>
            <span className="li-sub">{archived ? "film wraca jako szkic" : "znika ze strony i z list; można przywrócić"}</span>
          </div>
          <button type="button" className="btn" onClick={() => { setError(null); setOpen(archived ? "restore" : "archive"); }}>
            <Icon name="archive" />
            {archived ? "Przywróć" : "Archiwizuj…"}
          </button>
        </li>
        <li>
          <div className="li-main">
            <span className="li-title">Usuń film na zawsze</span>
            <span className="li-sub">kasuje film, komentarze, wersje HLS, oryginał i napisy; nie da się cofnąć</span>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => { setError(null); setOpen("delete"); }}>
            <Icon name="trash" />
            Usuń…
          </button>
        </li>
      </ul>
      <ConfirmDialog open={!!open} options={open ? options[open] : null} busy={pending} error={error} onConfirm={confirm} onClose={() => setOpen(null)} />
    </section>
  );
}
