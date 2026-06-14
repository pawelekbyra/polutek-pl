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
  const revokedGrantCount = user.patronGrants?.filter((grant:
any) => Boolean(grant.revokedAt)).length ?? 0;
  const paymentCount = user.payments?.length ?? 0;
  const latestPayment = user.payments?.[0];
  const hasPaymentFacts = paymentCount > 0 || (user.normalizedTotal ?? 0) > 0;
  const paidButLocked = hasPaymentFacts && activeGrantCount === 0;
  const subscriptionCount = user.subscriptions?.length ?? 0;

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-[10px] text-muted-foreground space-y-3" aria-label="Paid-but-locked access diagnostics">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-foreground">Access diagnostics</p>
        <Badge variant={activeGrantCount > 0 ? "default" : "outline"} className="text-[9px]">
          PatronGrant truth: {activeGrantCount > 0 ? "ACTIVE" : "LOCKED"}
        </Badge>
      </div>

      {paidButLocked && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
          Paid-but-locked: payment facts exist, but there is no active PatronGrant. Treat as support diagnostic, not automatic access.
        </div>
      )}

      <dl className="grid grid-cols-1 gap-2">
        <div>
          <dt className="font-bold text-foreground">PatronGrant truth</dt>
          <dd>Active grants: {activeGrantCount}</dd>
          <dd>First active grant: {formatDate(patronTruth?.firstActiveGrantAt || null)}</dd>
          <dd>Revoked grants: {revokedGrantCount}</dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Payment facts (not access truth)</dt>
          <dd>Total support facts: ~{(user.normalizedTotal ?? 0).toFixed(2)} PLN</dd>
          <dd>Payment rows loaded: {paymentCount}</dd>
          <dd>Latest payment: {latestPayment ? `${formatMoney(latestPayment.amountMinor, latestPayment.currency)} / ${latestPayment.status}` : "—"}</dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Cache mismatch diagnostic</dt>
          <dd>User.isPatron cache: {String(patronCache?.isPatron ?? user.isPatron)} (cache only)</dd>
          <dd>Cache patronSince: {formatDate(patronCache?.patronSince || user.patronSince)}</dd>
          <dd>Cache patronSource: {patronCache?.patronSource || user.patronSource || "—"}</dd>
          <dd>
            Mismatch: {patronMismatch?.hasMismatch
              ? `cache=${String(patronMismatch.cacheSaysPatron)} truth=${String(patronMismatch.truthSaysPatron)}`
              : "none"}
          </dd>
        </div>

        <div>
          <dt className="font-bold text-foreground">Newsletter/subscription (unrelated to access)</dt>
          <dd>Subscriptions/newsletter rows: {subscriptionCount}</dd>
          <dd>Subscription is mailing/follow consent only and does not grant or revoke patron access.</dd>
        </div>
      </dl>
    </div>
  );
}
