"use client";

import { Badge } from "@/components/ui/badge";

interface AdminAccessDiagnosticsProps {
  user: any;
  formatDate: (value: string | Date | null) => string;
}

function formatMoney(amountMinor: number | null | undefined, currency: string | null | undefined) {
  if (typeof amountMinor !== "number" || !currency) return "—";
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

export function AdminAccessDiagnostics({ user, formatDate }: AdminAccessDiagnosticsProps) {
  const patronTruth = user.patronDiagnostics?.truth;
  const activeGrantCount = patronTruth?.activeGrantCount ?? 0;
  const revokedGrantCount = user.patronGrants?.filter((grant: any) => Boolean(grant.revokedAt)).length ?? 0;
  const paymentCount = user.payments?.length ?? 0;
  const latestPayment = user.payments?.[0];
  const subscriptionCount = user.subscriptions?.length ?? 0;

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-[10px] text-muted-foreground space-y-3" aria-label="Diagnostyka wsparcia">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-foreground">Diagnostyka wsparcia</p>
        <Badge variant={activeGrantCount > 0 ? "default" : "outline"} className="text-[9px]">
          Odznaka Patrona: {activeGrantCount > 0 ? "TAK" : "NIE"}
        </Badge>
      </div>

      <p>Status Patrona to tylko odznaka — dostęp do filmów zależy wyłącznie od zalogowania.</p>

      <dl className="grid grid-cols-1 gap-2">
        <div>
          <dt className="font-bold text-foreground">PatronGrant (źródło odznaki)</dt>
          <dd>Aktywne uprawnienia: {activeGrantCount}</dd>
          <dd>Pierwsze aktywne uprawnienie: {formatDate(patronTruth?.firstActiveGrantAt || null)}</dd>
          <dd>Cofnięte uprawnienia: {revokedGrantCount}</dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Fakty płatności</dt>
          <dd>Suma wsparcia: ~{(user.normalizedTotal ?? 0).toFixed(2)} PLN</dd>
          <dd>Wczytane płatności: {paymentCount}</dd>
          <dd>Ostatnia płatność: {latestPayment ? `${formatMoney(latestPayment.amountMinor, latestPayment.currency)} / ${latestPayment.status}` : "—"}</dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Newsletter/subskrypcja</dt>
          <dd>Wiersze subskrypcji/newslettera: {subscriptionCount}</dd>
          <dd>Subskrypcja oznacza tylko zgodę mailingową/obserwowanie i nie nadaje ani nie cofa statusu Patrona.</dd>
        </div>
      </dl>
    </div>
  );
}
