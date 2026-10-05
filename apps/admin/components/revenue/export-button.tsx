"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

/** Downloads the CSV through the guarded route; without a fresh step-up the owner is sent to confirm first. */
export function ExportButton({ query, returnTo, filename = "wplaty.csv", url = "/api/export/payments" }: { query: string; returnTo: string; filename?: string; url?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`${url}${query ? `?${query}` : ""}`).catch(() => null);
    setBusy(false);
    if (!res) return toast("crit", "Brak połączenia z panelem.");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
      if (body?.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent(returnTo)}`);
      return toast("crit", body?.error ?? `Błąd eksportu (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? filename;
    a.click();
    URL.revokeObjectURL(href);
    toast("ok", "Eksport gotowy", `${res.headers.get("x-export-rows") ?? "?"} wierszy; wpis w audycie.`);
  };
  return (
    <button type="button" className="btn" aria-busy={busy} onClick={run}>
      <Icon name="download" />
      {busy ? "Przygotowuję…" : "Eksport CSV"}
    </button>
  );
}
