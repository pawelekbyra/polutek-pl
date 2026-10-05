"use client";

import React from "react";
import { Field, PrimaryButton } from "./AuthFormParts";
import type { Tx } from "@/lib/i18n/ui";

/** Second sign-in step for accounts with TOTP: code or backup code, optional "remember this device" (off by default). */
export function TwoFactorView(props: {
  tx: Tx;
  code: string;
  onCodeChange: (value: string) => void;
  useBackupCode: boolean;
  onToggleBackup: () => void;
  trustDevice: boolean;
  onTrustChange: (value: boolean) => void;
  loading: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const { tx, useBackupCode } = props;
  return (
    <form onSubmit={props.onSubmit} className="mt-5 space-y-3.5">
      <p className="text-[13px] text-[var(--chan-body)]">
        {useBackupCode
          ? (tx("Wpisz jeden z kodów zapasowych.", "Enter one of your backup codes."))
          : (tx("Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.", "Enter the 6-digit code from your authenticator app."))}
      </p>
      <Field
        label={useBackupCode ? (tx("Kod zapasowy", "Backup code")) : (tx("Kod", "Code"))}
        type="text"
        value={props.code}
        onChange={props.onCodeChange}
        inputMode={useBackupCode ? "text" : "numeric"}
        autoComplete="one-time-code"
        required
      />
      {!useBackupCode && (
        <label className="flex items-center gap-2 text-[12px] text-[var(--chan-body)]">
          <input type="checkbox" checked={props.trustDevice} onChange={(e) => props.onTrustChange(e.target.checked)} />
          {tx("Zapamiętaj to urządzenie na 7 dni", "Remember this device for 7 days")}
        </label>
      )}
      <PrimaryButton loading={props.loading} label={tx("Potwierdź", "Verify")} />
      <button type="button" className="text-[12px] text-[var(--chan-muted)] underline" onClick={props.onToggleBackup}>
        {useBackupCode ? (tx("Użyj aplikacji", "Use the app")) : (tx("Użyj kodu zapasowego", "Use a backup code"))}
      </button>
    </form>
  );
}
