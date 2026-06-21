# ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 — CI blocker reconciliation

Status: CI_BLOCKER_FIX_APPLIED
Launch status: NO_GO
Ticket: ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001
Scope: strict-escapes guard drift and npm audit/security lockfile sync only

## Summary

This follow-up fixes only the remaining CI blockers reported after PR #1004 was rebased on `main`:

1. strict-escapes baseline drift caused by approved historical entries moving line numbers;
2. npm audit/security setup drift caused by `package-lock.json` retaining an older root `@vitest/ui` spec than `package.json`.

No product scope, launch status, runtime product behavior, schema, migrations, or roadmap status was changed. Public launch remains `NO_GO`.

## Strict-escapes result

The strict-escapes checker now matches approved historical baseline entries by stable violation identity (`file`, `label`, and exact trimmed text) instead of requiring the recorded line number to remain unchanged. It still counts duplicate identical violations, so adding another matching `any`/`@ts-ignore`/`@ts-nocheck` line beyond the approved baseline count is reported as new unbaselined debt.

Validation result:

```txt
npm run quality:strict-escapes
PASS
Strict escapes baseline entries: 110
Matched historical violations: 110
Missing/stale baseline entries: 0
New unbaselined violations: 0
Only approved historical strict TypeScript escape hatches were found; no new debt detected.
```

## npm audit/security result

Local `npm audit --audit-level=high` could not reach the registry audit endpoint from this container; npm returned `403 Forbidden` for `POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`. The attempted smallest lockfile remediation was `npm audit fix --package-lock-only --audit-level=high`, which reached the same registry 403 but synchronized the root lockfile devDependency spec from `@vitest/ui: ^4.1.7` to the already-declared `package.json` value `^4.1.8`.

A local offline audit after the lockfile sync reported zero vulnerabilities, but this is not production/security certification because the live audit endpoint remained unavailable from this environment.

Validation result:

```txt
npm audit --audit-level=high
WARNING / ENVIRONMENT LIMITATION
npm warn audit 403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
```

```txt
npm audit --offline --audit-level=high
PASS
found 0 vulnerabilities
```

## Full requested validation

Commands run for this follow-up:

- `npm run quality:strict-escapes` — PASS.
- `npm audit --audit-level=high` — WARNING / environment limitation: registry audit endpoint returned `403 Forbidden`.
- `npm audit --offline --audit-level=high` — PASS, found 0 vulnerabilities.
- `npm run typecheck` — FAIL / pre-existing schema-client mismatch outside this CI-blocker scope: `PaymentWhereInput` and `PaymentCreateInput` do not include `requestId` while payment code expects it.
- `npm run build` — FAIL / same type error at `lib/modules/payments/infrastructure/payment.repository.ts:23`.
- `npm run lint` — PASS, no ESLint warnings or errors.
- `npm run test:coverage` — PASS, 157 files passed / 1 skipped; 870 tests passed / 2 skipped.
- `node scripts/check-control-plane-docs.mjs` — PASS.

## Scope confirmation

Changed files:

- `scripts/check-strict-escapes.ts`
- `package-lock.json`
- `docs/reports/reconciliation/ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001.md`

What did not change:

- no product scope changes;
- no launch status changes;
- no runtime admin/channel behavior changes;
- no schema or migration changes;
- no package broad-upgrade sweep;
- no dependency vulnerability suppression;
- no merge performed.

## Risks and follow-ups

- Live `npm audit --audit-level=high` must be confirmed in CI or another environment that can reach the npm audit bulk advisory endpoint.
- The strict-escapes baseline still represents historical debt; this change only prevents approved entries from failing solely because unrelated edits moved line numbers.
