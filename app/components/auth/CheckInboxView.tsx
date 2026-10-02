"use client";

import React from "react";
import { Mail } from "lucide-react";

type Props = {
  isPl: boolean;
  /** "verify": confirm a new account; "reset": password reset link. */
  kind: "verify" | "reset";
  email: string;
  onResend?: () => void;
  onChangeEmail?: () => void;
  onBack: () => void;
  /** Bot check node rendered by the modal (stays out of layout unless a challenge is needed). */
  captcha?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * "Check your inbox" screen after sign-up or a password-reset request: says where the e-mail went,
 * what to do next and what to do when it does not arrive (spam folder, resend, wrong address).
 */
export default function CheckInboxView({ isPl, kind, email, onResend, onChangeEmail, onBack, captcha, loading, disabled }: Props) {
  const steps =
    kind === "verify"
      ? isPl
        ? ["Otwórz wiadomość od nas", "Kliknij link potwierdzający", "Wybierz swój pseudonim i oglądaj"]
        : ["Open the message from us", "Click the confirmation link", "Pick your nickname and start watching"]
      : isPl
        ? ["Otwórz wiadomość od nas", "Kliknij link", "Ustaw nowe hasło (link działa godzinę)"]
        : ["Open the message from us", "Click the link", "Set a new password (the link works for one hour)"];

  const lead =
    kind === "verify"
      ? isPl
        ? "Wysłaliśmy link potwierdzający na adres"
        : "We sent a confirmation link to"
      : isPl
        ? "Jeśli konto istnieje, wysłaliśmy link do ustawienia hasła na adres"
        : "If an account exists, we sent a password link to";

  return (
    <div className="mt-5 space-y-4 text-center" data-testid="check-inbox">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]">
        <Mail className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <p className="text-[13px] text-[var(--chan-body)]">{lead}</p>
        <p className="mx-auto max-w-full break-all rounded-xl bg-[var(--chan-surface)] px-3 py-2 text-[14px] font-bold text-[var(--chan-ink)]">
          {email || "—"}
        </p>
      </div>

      <ol className="space-y-2 text-left">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-3 text-[13px] text-[var(--chan-body)]">
            <span
              aria-hidden="true"
              className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[11px] font-extrabold text-[var(--chan-ink)]"
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="rounded-xl border border-[var(--chan-line)] bg-[var(--chan-surface)] px-3 py-2.5 text-left text-[12px] leading-snug text-[var(--chan-muted)]">
        {isPl
          ? "Nie ma wiadomości? Zajrzyj do folderu Spam lub Wiadomości-śmieci i oznacz nas jako bezpiecznych. Nowe strony czasem tam trafiają."
          : "Nothing yet? Check your Spam or Junk folder and mark us as safe. Messages from new sites sometimes land there."}
      </p>

      {captcha}

      <div className="space-y-2.5 pt-1">
        {onResend ? (
          <button
            type="button"
            onClick={onResend}
            disabled={loading || disabled}
            className="flex h-[44px] w-full items-center justify-center rounded-[12px] border border-[var(--chan-line)] bg-white font-brand text-[14px] font-bold text-[var(--chan-ink)] transition-[border-color,transform] duration-160 hover:border-[var(--chan-blue)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {isPl ? "Wyślij link ponownie" : "Send the link again"}
          </button>
        ) : null}
        <div className="flex flex-col items-center gap-1.5 text-[12px] text-[var(--chan-muted)]">
          {onChangeEmail ? (
            <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={onChangeEmail}>
              {isPl ? "Zły adres? Wpisz inny" : "Wrong address? Use another"}
            </button>
          ) : null}
          <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={onBack}>
            {isPl ? "Wróć do logowania" : "Back to sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
