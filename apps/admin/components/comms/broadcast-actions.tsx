"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cancelBroadcastAction } from "@admin/app/(panel)/komunikacja/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { useToast } from "@admin/components/shell/toasts";

export function CancelBroadcastButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await cancelBroadcastAction({ id });
      if (!res.ok) return setError(res.message);
      setOpen(false);
      toast("ok", res.message ?? "Anulowano");
      router.refresh();
    });
  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => { setError(null); setOpen(true); }}>Anuluj…</button>
      <ConfirmDialog open={open} busy={pending} error={error} onConfirm={run} onClose={() => setOpen(false)} options={{ title: "Anulować rozsyłkę?", body: `„${title}” nie zostanie wysłana dalej. Osoby, do których już poszła, mają wiadomość.`, confirm: "Anuluj rozsyłkę", effect: ["adresaci bez wysłanej wiadomości zostają pominięci", "wpis BROADCAST_CANCELLED w audycie"] }} />
    </>
  );
}

/** While a broadcast is being sent the page re-reads itself every 10 s (and stops when nothing is active). */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
