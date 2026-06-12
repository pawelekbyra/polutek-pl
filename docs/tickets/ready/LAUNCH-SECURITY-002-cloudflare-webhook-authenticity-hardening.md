# LAUNCH-SECURITY-002 — Cloudflare webhook authenticity hardening

Status: IMPLEMENTED_VERIFIED

## Why this is next

LAUNCH-SECURITY-001 verified that the current Cloudflare Stream webhook route rejects missing/invalid `cf-webhook-signature` when `CLOUDFLARE_WEBHOOK_SECRET` is configured and fails closed in production when the secret is missing. The audit could not prove from current code that this header matches an official Cloudflare Stream webhook-signature scheme. Current code uses a shared-secret equality check rather than a provider-documented HMAC/timestamp verification boundary.

## Scope

- Confirm the official Cloudflare Stream webhook authenticity mechanism from current Cloudflare documentation.
- Replace or augment the local `cf-webhook-signature === CLOUDFLARE_WEBHOOK_SECRET` check only if Cloudflare documents a stronger provider signature scheme for Stream webhooks.
- Preserve raw-body handling if the provider scheme requires it.
- Add deterministic route tests for:
  - missing secret fails closed in production;
  - missing signature produces no mutation;
  - invalid signature produces no mutation;
  - valid signed payload reaches `handleCloudflareStreamWebhook`;
  - replay/timestamp handling if documented by Cloudflare;
  - route logs and responses do not expose secrets, raw payload playback URLs or provider tokens.

## Allowed paths

- `app/api/webhooks/cloudflare-stream/route.ts`
- `tests/unit/api/webhooks/cloudflare-stream.test.ts`
- `tests/unit/security/**`
- `docs/reports/reconciliation/LAUNCH-SECURITY-002-*.md`

## Forbidden paths

- schema and migrations;
- package files;
- build-owned files (`next.config.*`, `vercel.json`, `app/layout.tsx`, `app/globals.css`, `app/components/ClerkLocalizationProvider.tsx`, `app/components/Providers.tsx`);
- global roadmap/strategy/spec/legal documents.

## Non-goals

- no new dependencies unless owner explicitly approves;
- no live webhook calls;
- no production certification claim.

## Acceptance criteria

- Provider authenticity semantics are documented with current Cloudflare evidence.
- Tests prove invalid/missing signatures cause zero side effects.
- Valid signed fixture reaches the use case.
- Production missing-secret behavior remains fail-closed.
- No secrets or signed media values are logged or returned.
