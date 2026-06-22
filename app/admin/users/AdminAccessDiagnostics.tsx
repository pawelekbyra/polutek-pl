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
  const patronCache = user.patronDiagnostics?.cache;
  const patronMismatch = user.patronDiagnostics?.cacheTruthMismatch;
  const activeGrantCount = patronTruth?.activeGrantCount ?? 0;
  const revokedGrantCount = user.patronGrants?.filter((grant: any) => Boolean(grant.revokedAt)).length ?? 0;
  const paymentCount = user.payments?.length ?? 0;
  const latestPayment = user.payments?.[0];
  const hasPaymentFacts = paymentCount > 0 || (user.normalizedTotal ?? 0) > 0;
  const paidButLocked = hasPaymentFacts && activeGrantCount === 0;
  const subscriptionCount = user.subscriptions?.length ?? 0;

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-[10px] text-muted-foreground space-y-3" aria-label="Diagnostyka dostępu paid-but-locked">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-foreground">Diagnostyka dostępu</p>
        <Badge variant={activeGrantCount > 0 ? "default" : "outline"} className="text-[9px]">
          Prawda PatronGrant: {activeGrantCount > 0 ? "AKTYWNY" : "ZABLOKOWANY"}
        </Badge>
      </div>

      {paidButLocked && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
          Paid-but-locked: istnieją fakty płatności, ale nie ma aktywnego PatronGrant. Traktuj to jako diagnostykę supportową, nie automatyczny dostęp.
        </div>
      )}

      <dl className="grid grid-cols-1 gap-2">
        <div>
          <dt className="font-bold text-foreground">Prawda dostępu PatronGrant</dt>
          <dd>Aktywne uprawnienia: {activeGrantCount}</dd>
          <dd>Pierwsze aktywne uprawnienie: {formatDate(patronTruth?.firstActiveGrantAt || null)}</dd>
          <dd>Cofnięte uprawnienia: {revokedGrantCount}</dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Fakty płatności (nie prawda dostępu)</dt>
          <dd>Suma wsparcia: ~{(user.normalizedTotal ?? 0).toFixed(2)} PLN</dd>
          <dd>Wczytane płatności: {paymentCount}</dd>
          <dd>Ostatnia płatność: {latestPayment ? `${formatMoney(latestPayment.amountMinor, latestPayment.currency)} / ${latestPayment.status}` : "—"}</dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Diagnostyka niezgodności cache</dt>
          <dd>Cache User.isPatron: {String(patronCache?.isPatron ?? user.isPatron)} (tylko cache)</dd>
          <dd>Cache patronSince: {formatDate(patronCache?.patronSince || user.patronSince)}</dd>
          <dd>Cache patronSource: {patronCache?.patronSource || user.patronSource || "—"}</dd>
          <dd>
            Niezgodność: {patronMismatch?.hasMismatch
              ? `cache=${String(patronMismatch.cacheSaysPatron)} truth=${String(patronMismatch.truthSaysPatron)}`
              : "brak"}
          </dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Newsletter/subskrypcja (niezwiązane z dostępem)</dt>
          <dd>Wiersze subskrypcji/newslettera: {subscriptionCount}</dd>
          <dd>Subskrypcja oznacza tylko zgodę mailingową/obserwowanie i nie nadaje ani nie cofa dostępu Patrona.</dd>
        </div>
      </dl>
    </div>
  );
}
