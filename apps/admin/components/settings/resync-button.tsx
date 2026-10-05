"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { resyncSubscribersAction } from "@admin/app/(panel)/ustawienia/actions";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function ResyncButton() {
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
          const res = await resyncSubscribersAction();
          toast(res.ok ? "ok" : "crit", res.ok ? (res.message ?? "Przeliczono") : res.message);
          if (res.ok) router.refresh();
        })
      }
    >
      <Icon name="refresh" />
      {pending ? "Liczę…" : "Przelicz"}
    </button>
  );
}
