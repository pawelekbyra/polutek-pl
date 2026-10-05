"use client";
/**
 * "Eksport CSV": POSTs the current search and segment, downloads the file from the answer. Personal data, so the
 * server needs a fresh step-up; on STEP_UP_REQUIRED we go to /potwierdz and return to this list to click again.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function ExportButton({ q, seg, returnPath }: { q?: string; seg?: string; returnPath: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/spolecznosc/uzytkownicy/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(q ? { q } : {}), ...(seg ? { seg } : {}) }) });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "uzytkownicy.csv";
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast("ok", `Pobrano ${res.headers.get("x-export-rows") ?? ""} wierszy`, "Eksport zapisany w dzienniku audytu (USERS_EXPORT).");
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (body?.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent(returnPath)}`);
      toast("crit", body?.error ?? "Nie udało się pobrać pliku.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn" aria-disabled={busy} onClick={() => !busy && void run()}>
      <Icon name="download" />
      {busy ? "Przygotowuję…" : "Eksport CSV"}
    </button>
  );
}
