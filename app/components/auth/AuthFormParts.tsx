"use client";

import React from "react";
import { Loader2 } from "../icons";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "./oauth-providers";

export function Field({
  label,
  type,
  value,
  onChange,
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
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[12px] border border-[var(--chan-line)] bg-[var(--chan-surface)] px-3 py-2 font-sans text-[15px] text-[var(--chan-ink)] outline-none transition-colors focus:border-[var(--chan-blue)]"
        {...rest}
      />
    </label>
  );
}

export function PrimaryButton({ loading, disabled, label }: { loading: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-blue)] font-brand text-[15px] font-bold text-white transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_8px_20px_var(--cm-blue-25)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span>{label}</span>}
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

export function Divider({ isPl }: { isPl: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[var(--chan-line)]" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{isPl ? "lub" : "or"}</span>
      <span className="h-px flex-1 bg-[var(--chan-line)]" />
    </div>
  );
}
