"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 7): the demo panel. Any signed-in viewer who
// sees the experiment may expire or delete THEIR OWN access, to look at every state without waiting. Shown only in demo
// mode or with Stripe TEST keys (the server refuses it with live keys).
import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/react";
import { useLanguage } from "../LanguageContext";
import { postDemoControl } from "./usePremiumPass";
import styles from "./premium-pass.module.css";

export function DemoControls({ onChanged }: { onChanged: () => void }) {
  const { tx } = useLanguage();
  const { userId } = useAuth();
  const panelId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  if (!mounted || !userId) return null;

  const run = async (action: "expire" | "reset") => {
    setBusy(true);
    const result = await postDemoControl(action);
    setBusy(false);
    if (!result && action === "expire") {
      setMessage(tx("Nie masz jeszcze dostępu do strefy patrona.", "You do not have patron zone access yet."));
      return;
    }
    setMessage(action === "expire" ? tx("Dostęp wygasł.", "Access has expired.") : tx("Dostęp usunięty.", "Access deleted."));
    onChanged();
  };

  return createPortal(
    <div className={styles.pass}>
      {open && (
        <div id={panelId} className={styles.panel} role="region" aria-label={tx("Panel demo", "Demo panel")}>
          <strong>{tx("Panel demo", "Demo panel")}</strong>
          <span className={styles.muted}>{tx("Działa tylko na Twoim własnym dostępie.", "Works on your own access only.")}</span>
          <button type="button" className={styles.lineBtn} disabled={busy} onClick={() => void run("expire")}>{tx("Wygaś mój dostęp teraz", "Expire my access now")}</button>
          <button type="button" className={styles.lineBtn} disabled={busy} onClick={() => void run("reset")}>{tx("Usuń mój dostęp", "Delete my access")}</button>
          <p className={styles.muted} role="status" aria-live="polite" style={{ margin: 0, minHeight: 16 }}>{message}</p>
        </div>
      )}
      <button type="button" className={cn(styles.fab)} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        DEMO
      </button>
    </div>,
    document.body,
  );
}
