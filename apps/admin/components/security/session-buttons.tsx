"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { revokeOtherSessionsAction, revokeSessionAction } from "@admin/app/(panel)/bezpieczenstwo/actions";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function RevokeSessionButton({ sessionId, label }: { sessionId: string; label: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-sm" aria-busy={pending} aria-label={`Wyloguj sesję: ${label}`} onClick={() => start(async () => {
      const res = await revokeSessionAction({ sessionId });
      toast(res.ok ? "ok" : "crit", res.ok ? (res.message ?? "Zakończono") : res.message);
      if (res.ok) router.refresh();
    })}>
      <Icon name="logout" />
      Wyloguj
    </button>
  );
}

export function RevokeOthersButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-sm" aria-busy={pending} onClick={() => start(async () => {
      const res = await revokeOtherSessionsAction();
      toast(res.ok ? "ok" : "crit", res.ok ? (res.message ?? "Zakończono") : res.message);
      if (res.ok) router.refresh();
    })}>
      Wyloguj inne
    </button>
  );
}
