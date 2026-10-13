"use client";

import { useId, useState } from "react";
import { useAuth } from "@/lib/auth/react";
import { useAuthModal } from "./auth/AuthModalProvider";
import { useLanguage } from "./LanguageContext";

type Props = { targetType: "VIDEO" | "CHANNEL"; targetId: string; className?: string };

const REASONS = ["SPAM", "HARASSMENT", "HATE", "NSFW", "VIOLENCE", "COPYRIGHT", "OTHER"] as const;

/**
 * "Report" for a video or a channel (DSA notice). Signed-out viewers are asked to sign in first. The report goes to
 * POST /api/user/reports and lands in the platform's queue (admin panel -> Kanaly -> Zgloszenia).
 */
export default function ReportButton({ targetType, targetId, className }: Props) {
  const { tx } = useLanguage();
  const { userId } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("SPAM");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const id = useId();

  const label: Record<(typeof REASONS)[number], string> = {
    SPAM: tx("Spam lub oszustwo", "Spam or scam"),
    HARASSMENT: tx("Nękanie", "Harassment"),
    HATE: tx("Mowa nienawiści", "Hate speech"),
    NSFW: tx("Treści dla dorosłych", "Adult content"),
    VIOLENCE: tx("Przemoc", "Violence"),
    COPYRIGHT: tx("Naruszenie praw autorskich", "Copyright violation"),
    OTHER: tx("Inny powód", "Other reason"),
  };

  const submit = async () => {
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/user/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? tx("Nie udało się wysłać zgłoszenia.", "Could not send the report."));
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError(tx("Nie udało się wysłać zgłoszenia.", "Could not send the report."));
      setState("error");
    }
  };

  if (state === "sent") {
    return <p className="text-sm text-[var(--chan-muted)]" role="status">{tx("Dziękujemy. Zgłoszenie trafiło do przeglądu.", "Thank you. Your report is queued for review.")}</p>;
  }

  return (
    <div className={className}>
      <button
        type="button"
        className="text-sm font-semibold text-[var(--chan-muted)] underline-offset-2 hover:underline"
        aria-expanded={openForm}
        aria-controls={`${id}-form`}
        onClick={() => (userId ? setOpenForm((v) => !v) : openAuthModal("sign-in"))}
      >
        {tx("Zgłoś", "Report")}
      </button>
      {openForm && userId ? (
        <form
          id={`${id}-form`}
          className="mt-2 grid max-w-sm gap-2 rounded-xl border border-[var(--chan-line)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-1 text-sm" htmlFor={`${id}-reason`}>
            <span>{tx("Powód zgłoszenia", "Reason for the report")}</span>
            <select id={`${id}-reason`} className="rounded-lg border border-[var(--chan-line)] bg-transparent p-2" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
              {REASONS.map((r) => (
                <option key={r} value={r}>{label[r]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm" htmlFor={`${id}-note`}>
            <span>{tx("Szczegóły (opcjonalnie)", "Details (optional)")}</span>
            <textarea id={`${id}-note`} className="rounded-lg border border-[var(--chan-line)] bg-transparent p-2" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {state === "error" ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
          <button type="submit" className="justify-self-start rounded-lg bg-[var(--chan-ink)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={state === "sending"}>
            {state === "sending" ? tx("Wysyłam…", "Sending…") : tx("Wyślij zgłoszenie", "Send report")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
