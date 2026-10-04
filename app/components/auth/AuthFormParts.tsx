"use client";

import React from "react";
import { Loader2 } from "../icons";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "./oauth-providers";

// The passkey button sits next to the Google button in the sign-in form.
export { PasskeySignIn } from "./PasskeySignIn";

export function Field({
  label,
  type,
  value,
  onChange,
  revealLabels,
  ...rest
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  required?: boolean;
  minLength?: number;
  revealLabels?: { show: string; hide: string };
}) {
  const [revealed, setRevealed] = React.useState(false);
  const isPassword = type === "password" && Boolean(revealLabels);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{label}</span>
      <span className="relative block">
        <input
          type={isPassword && revealed ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-[12px] border border-[var(--chan-line)] bg-[var(--chan-surface)] py-2 pl-3 font-sans text-[15px] text-[var(--chan-ink)] outline-none transition-colors focus:border-[var(--chan-blue)] ${isPassword ? "pr-16" : "pr-3"}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)] hover:text-[var(--chan-ink)]"
          >
            {revealed ? revealLabels?.hide : revealLabels?.show}
          </button>
        )}
      </span>
    </label>
  );
}

export function PrimaryButton({
  loading,
  disabled,
  label,
}: {
  /** A request is running (or queued for the bot check): spinner next to the label, button disabled. */
  loading: boolean;
  disabled?: boolean;
  label: string;
}) {
  const spinning = loading;
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      aria-busy={spinning || undefined}
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-blue)] font-brand text-[15px] font-bold text-white transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_8px_20px_var(--cm-blue-25)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      {/* The label stays while working, so the button never turns into a bare, unexplained spinner. */}
      {spinning && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

export function OAuthButtons({
  onSelect,
  isPl,
  disabled,
}: {
  onSelect: (provider: OAuthProviderId) => void;
  isPl: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {OAUTH_PROVIDERS.map(({ provider, label, Icon }) => (
        <button
          key={provider}
          type="button"
          onClick={() => onSelect(provider)}
          disabled={disabled}
          className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-surface)] font-sans text-[14px] font-bold text-[var(--chan-ink)] transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-[0.98] disabled:opacity-60"
        >
          <Icon className="h-[18px] w-[18px]" />
          <span>{isPl ? `Kontynuuj z ${label}` : `Continue with ${label}`}</span>
        </button>
      ))}
    </div>
  );
}

/** Owner decision 2026-10-02: a sign-up with an address that already has an account says so, with the ways in. */
export function EmailTakenActions({
  isPl,
  kind,
  onSignIn,
  onForgot,
}: {
  isPl: boolean;
  kind: "google" | "password";
  onSignIn: () => void;
  onForgot: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
      <button type="button" className="font-bold underline hover:text-[var(--chan-ink)]" onClick={onSignIn}>
        {isPl ? "Zaloguj się" : "Sign in"}
      </button>
      <button type="button" className="font-bold underline hover:text-[var(--chan-ink)]" onClick={onForgot}>
        {isPl ? "Nie pamiętam hasła" : "Forgot password"}
      </button>
      {kind === "google" && (
        <span className="text-[var(--chan-muted)]">{isPl ? "Możesz też użyć przycisku Google." : "You can also use the Google button."}</span>
      )}
    </div>
  );
}

/** Under "Continue with Google / a passkey": both create the account when there is none. */
export function NewHereNote({ isPl }: { isPl: boolean }) {
  return (
    <p className="text-center text-[12px] text-[var(--chan-muted)]">
      {isPl ? "Nowy tutaj? Konto założymy automatycznie." : "New here? We'll create your account automatically."}
    </p>
  );
}

/** Bottom of the sign-in view: password reset, and the way to the e-mail sign-up (question grey, action blue). */
export function SignInLinks({ isPl, onForgot, onSignUp }: { isPl: boolean; onForgot: () => void; onSignUp: () => void }) {
  return (
    <div className="space-y-2 pt-1 text-center text-[12px] text-[var(--chan-muted)]">
      <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={onForgot}>
        {isPl ? "Nie pamiętam hasła" : "Forgot password"}
      </button>
      <p>
        {isPl ? "Nie masz konta?" : "Don't have an account?"}{" "}
        <button type="button" className="font-bold text-[var(--chan-blue)] hover:underline" onClick={onSignUp}>
          {isPl ? "Załóż konto" : "Create account"}
        </button>
      </p>
    </div>
  );
}

export function Divider({ isPl }: { isPl: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[var(--chan-line)]" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{isPl ? "lub" : "or"}</span>
      <span className="h-px flex-1 bg-[var(--chan-line)]" />
    </div>
  );
}
