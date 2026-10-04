"use client";
/** Status buttons of a film (publish, unpublish, archive, restore, duplicate), each behind a confirmation. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { filmStatusAction } from "@admin/app/(panel)/tresci/actions";
import { ConfirmDialog, type ConfirmOptions } from "@admin/components/confirm-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

type Op = "publish" | "unpublish" | "archive" | "restore" | "duplicate";

const OPTIONS = (title: string): Record<Op, ConfirmOptions> => ({
  publish: { title: `Opublikować „${title}”?`, confirm: "Opublikuj", effect: ["film pojawia się na stronie w swojej sekcji", "publiczna kopia miniatury powstaje w R2", "wpis VIDEO_PUBLISHED w audycie"] },
  unpublish: { title: `Cofnąć publikację „${title}”?`, confirm: "Cofnij publikację", effect: ["film wraca do szkiców i znika ze strony", "zdejmowany z listy filmów i z Hero", "publiczna kopia miniatury jest usuwana"] },
  archive: { title: `Archiwizować „${title}”?`, confirm: "Archiwizuj", body: "Film zniknie ze strony i z list. Możesz go przywrócić.", effect: ["znika z listy filmów i z Hero", "publiczna miniatura usunięta", "komentarze i statystyki zostają"] },
  restore: { title: `Przywrócić „${title}” do szkiców?`, confirm: "Przywróć", effect: ["film wraca jako szkic (niewidoczny na stronie)", "publikujesz go osobno"] },
  duplicate: { title: `Utworzyć kopię „${title}”?`, confirm: "Utwórz kopię", effect: ["nowy szkic z tym samym tytułem, opisem i dostępem", "bez wideo, miniatury i napisów: wgrasz je w edycji"] },
});

export function FilmActions({ id, title, ops, primary }: { id: string; title: string; ops: Op[]; primary?: Op }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState<Op | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const options = OPTIONS(title);

  const run = (op: Op) =>
    start(async () => {
      const res = await filmStatusAction({ id, op });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOpen(null);
      setError(null);
      toast("ok", res.message ?? "Zapisano");
      if (op === "duplicate" && res.data?.slug) router.push(`/tresci/${res.data.slug}/edycja`);
      else router.refresh();
    });

  const label: Record<Op, string> = { publish: "Opublikuj", unpublish: "Cofnij publikację", archive: "Archiwizuj…", restore: "Przywróć do szkiców", duplicate: "Duplikuj" };
  return (
    <>
      {ops.map((op) => (
        <button key={op} type="button" className={`btn${op === primary ? " btn-primary" : ""}`} onClick={() => { setError(null); setOpen(op); }}>
          {op === "duplicate" ? <Icon name="copy" /> : op === "archive" ? <Icon name="archive" /> : null}
          {label[op]}
        </button>
      ))}
      <ConfirmDialog open={!!open} options={open ? options[open] : null} busy={pending} error={error} onConfirm={() => open && run(open)} onClose={() => setOpen(null)} />
    </>
  );
}
