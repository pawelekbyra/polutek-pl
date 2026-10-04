"use client";
/** Buttons of one comment (hide, restore, approve, delete) and of one report (dismiss, act). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moderateCommentAction, resolveReportAction } from "@admin/app/(panel)/spolecznosc/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { useToast } from "@admin/components/shell/toasts";

type Op = "hide" | "restore" | "approve" | "delete";

export function CommentButtons({ commentId, status, author }: { commentId: string; status: string; author: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (op: Op) =>
    start(async () => {
      const res = await moderateCommentAction({ commentId, op });
      if (op === "delete" && !res.ok) return setError(res.message);
      setConfirmDelete(false);
      toast(res.ok ? "ok" : "crit", res.ok ? res.message ?? "Zapisano" : res.message);
      if (res.ok) router.refresh();
    });
  const ops: Op[] = status === "VISIBLE" ? ["hide"] : status === "HELD_FOR_REVIEW" ? ["approve", "hide"] : status === "HIDDEN" ? ["restore"] : [];
  const label: Record<Op, string> = { hide: "Ukryj", restore: "Przywróć", approve: "Zatwierdź", delete: "Usuń…" };
  return (
    <span className="li-actions">
      {ops.map((op) => (
        <button key={op} type="button" className={`btn btn-sm${op === "approve" ? " btn-primary" : ""}`} aria-disabled={pending} onClick={() => !pending && run(op)}>
          {label[op]}
          <span className="sr-only"> komentarz {author}</span>
        </button>
      ))}
      {status !== "DELETED" ? (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setError(null); setConfirmDelete(true); }}>
          Usuń…<span className="sr-only"> komentarz {author}</span>
        </button>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        options={{ title: "Usunąć komentarz?", confirm: "Usuń komentarz", danger: true, effect: ["znika ze strony dla wszystkich", "treść zostaje w panelu jako dowód moderacji", "tego nie da się przywrócić"] }}
        busy={pending}
        error={error}
        onConfirm={() => run("delete")}
        onClose={() => setConfirmDelete(false)}
      />
    </span>
  );
}

export function ReportButtons({ reportId, commentId }: { reportId: string; commentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (decision: "dismiss" | "act") =>
    start(async () => {
      const res = await resolveReportAction({ reportId, decision, commentId });
      toast(res.ok ? "ok" : "crit", res.ok ? res.message ?? "Zapisano" : res.message);
      if (res.ok) router.refresh();
    });
  return (
    <span className="li-actions">
      <button type="button" className="btn btn-sm btn-primary" aria-disabled={pending} onClick={() => !pending && run("act")}>
        Uznaj i ukryj
      </button>
      <button type="button" className="btn btn-sm" aria-disabled={pending} onClick={() => !pending && run("dismiss")}>
        Oddal
      </button>
    </span>
  );
}
