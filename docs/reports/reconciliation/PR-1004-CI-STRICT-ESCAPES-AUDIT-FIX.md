# PR #1004 CI strict-escapes and audit/security follow-up

Date: 2026-06-21
Launch status: NO_GO

## Intent

Fix only the two remaining CI failures reported for PR #1004 after rebasing on `main`:

- `strict escapes`
- `npm audit/security`

No product scope, access policy, launch status, schema, migrations, roadmap, or public-launch certification changes were made.

## Strict escapes fix

Removed the newly introduced `as any` casts in the admin video edit/duplicate form mapping and removed the corresponding stale entries from the strict-escapes baseline. The strict-escapes gate now reports zero stale baseline entries and zero new unbaselined violations.

Changed files:

- `app/admin/videos/components/useAdminVideos.ts`
- `app/admin/videos/page.tsx`
- `scripts/strict-escapes-baseline.jsonc`

## Audit/security fix

Removed the unused direct `@vitest/ui` dev dependency from the project manifest and refreshed the lockfile. The test suite runs through the CLI `vitest` dependency; no package script references `@vitest/ui` or `vitest --ui`.

Changed files:

- `package.json`
- `package-lock.json`

## Validation results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run quality:strict-escapes` | PASS | 105 baseline entries matched; 0 stale entries; 0 new unbaselined violations. |
| `npm ci --ignore-scripts --offline` | PASS | Reinstalled from lockfile; audited 976 packages; found 0 vulnerabilities. Warning: local Node is `v24.15.0`, while repo requires `22.x`. |
| `npm audit --audit-level=high --offline` | PASS | Found 0 vulnerabilities using the locally available audit data/lockfile state. |
| `npm audit --audit-level=high` | BLOCKED / ENVIRONMENT | Local registry audit endpoint returns `403 Forbidden` through the configured proxy; this environment cannot provide an online audit pass. |
| `npm run typecheck` | FAIL / PRE-EXISTING | Fails in payment files because generated Prisma types lack `Payment.requestId`; not part of the requested two-job fix. |

## Scope confirmation

- Public launch remains `NO_GO`.
- No merge was performed.
- No product behavior, access policy, payment lifecycle, video playback policy, schema, migrations, global roadmap, or certification status was changed.

## Risks and follow-ups

- CI should provide the authoritative online `npm audit --audit-level=high` result because the local environment blocks npm registry audit requests with `403 Forbidden`.
- Existing typecheck failures in the payments/Prisma surface remain out of scope for this follow-up.
