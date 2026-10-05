"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { syncDisputeAction } from "@admin/app/(panel)/przychody/actions";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function SyncDisputeButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm"
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const res = await syncDisputeAction({ paymentId });
          toast(res.ok ? "ok" : "crit", res.ok ? (res.message ?? "Zsynchronizowano") : res.message);
          if (res.ok) router.refresh();
        })
      }
    >
      <Icon name="refresh" />
      {pending ? "Pytam Stripe…" : "Odśwież ze Stripe"}
    </button>
  );
}
