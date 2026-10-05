"use client";

import React from "react";
import { Field, PrimaryButton } from "./AuthFormParts";
import type { Tx } from "@/lib/i18n/ui";

/** Modal view shown after an expired/used e-mail verification link: ask for the address, send a new link. */
export function LinkExpiredView(props: {
  tx: Tx;
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  captcha: React.ReactNode;
  loading: boolean;
  onBack: () => void;
}) {
  const { tx } = props;
  return (
    <form onSubmit={props.onSubmit} className="mt-5 space-y-3.5">
      <p className="text-[13px] text-[var(--chan-body)]">
        {tx("Ten link potwierdzający wygasł albo został już użyty. Podaj e-mail, a wyślemy nowy.", "This confirmation link has expired or was already used. Enter your email and we'll send a new one.")}
      </p>
      <Field label="E-mail" type="email" value={props.email} onChange={props.onEmailChange} autoComplete="email" required />
      {props.captcha}
      <PrimaryButton loading={props.loading} label={tx("Wyślij nowy link", "Send a new link")} />
      <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
        <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={props.onBack}>
          {tx("Wróć do logowania", "Back to sign in")}
        </button>
      </div>
    </form>
  );
}
