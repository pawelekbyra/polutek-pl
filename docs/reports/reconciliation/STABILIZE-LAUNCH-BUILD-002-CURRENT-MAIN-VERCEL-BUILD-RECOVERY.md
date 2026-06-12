# STABILIZE-LAUNCH-BUILD-002 — Current-main Vercel build recovery report

## 1. Baseline main SHA

- Baseline branch at start: `work` (local branch containing current main merge history; no `origin` remote was configured in this container).
- Baseline SHA: `cd6e9f9638e47d90a263d4be85b760c584e2d6a1`.
- Latest visible commit: `Merge pull request #879 from pawelekbyra/launch-ops-002-db-backup-drill-18057823859520263300`.

## 2. Initial Vercel status

- Current deployment check was reported by the ticket as failing.
- This container has no configured Git remote and no `vercel` CLI available, so the live Vercel check could not be inspected from the shell.
- Local `npm run vercel-build` was used as the reproducible build evidence.

## 3. Reproduced local failure

Baseline commands before edits:

- `git status --short`: clean.
- `git branch --show-current`: `work`.
- `git rev-parse HEAD`: `cd6e9f9638e47d90a263d4be85b760c584e2d6a1`.
- `git log --oneline -15`: showed PR #879 through PR #872 merge history.
- `node --version`: `v24.15.0`.
- `npm --version`: `11.4.2`.
- `npm run db:generate`: passed.
- `npm run typecheck`: passed.
- `npm run vercel-build`: failed during `next build` while fetching Google Fonts.

First real failure classification: `remote font dependency`.

Exact first build failure class:

```txt
Failed to fetch font `Inter`.
URL: https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap
```

The same build also failed to fetch `Plus Jakarta Sans`, `Space Grotesk`, `Outfit`, and `Gluten` from Google Fonts.

## 4. Root cause

`app/layout.tsx` imported five font families from `next/font/google`. Next.js resolves those at production build time, so restricted-network environments fail before completing the build.

After removing the remote font dependency, the next verified build blockers were operator environment/configuration blockers:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` absent during static prerender of static legal/not-found routes.
- `DATABASE_URL` absent while DB-backed content code executed during static generation/page-data collection.

These were not hidden with fake values because production auth/database configuration must remain explicit.

## 5. Font findings

Before the fix, `app/layout.tsx` actively imported:

- `Inter`
- `Outfit`
- `Plus_Jakarta_Sans`
- `Gluten`
- `Space_Grotesk`

from `next/font/google`.

The implementation removed those active imports and the corresponding `next/font/google` initializers. Existing CSS font variables remain defined in `app/globals.css` as deterministic local/system stacks:

- `--font-inter`
- `--font-outfit`
- `--font-jakarta`
- `--font-space-grotesk`
- `--font-gluten`

No Google CSS `@import`, committed font files, client-side font loader, dependency, or package change was added.

## 6. Sitemap findings

`app/sitemap.ts` was DB-backed: it attempted to include the configured creator route and public published video URLs when available.

The implementation keeps that contract but makes failures safe:

- core route generation is independent of database connectivity,
- creator route lookup falls back to no creator route on failure,
- public video lookup falls back to no video routes on failure,
- video IDs are URL-encoded,
- sitemap entries remain valid page URLs,
- private media source URLs, signed URLs, provider IDs, Cloudflare/Mux identifiers, and tokens are not included.

Demo/private fallback data was not introduced into sitemap generation.

## 7. Clerk findings

`ClerkLocalizationProvider` still throws when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is absent. This is intentional for real application runtime and was not suppressed with fake keys.

After the font fix, `npm run vercel-build` reached static generation and failed prerendering `/_not-found`, `/polityka-prywatnosci`, and `/regulamin` because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` was not set. Per the ticket, this remains an operator environment blocker rather than a code workaround.

## 8. Database build/runtime findings

`npm run db:generate` passed without requiring database connectivity.

After the font fix, `next build` reached static generation/page-data collection and emitted a Prisma validation error because `DATABASE_URL` was not set. The application database was not made optional; no Prisma schema, migration, `DATABASE_URL` semantics, runtime payment/access/video DB behavior, or production health semantics were changed.

Sitemap now handles DB-backed content lookup failures by returning the static core route rather than requiring production database connectivity for sitemap output.

## 9. Historical #868 assessment

PR #868 is documented elsewhere as closed/unmerged. This task did not copy or cherry-pick #868. In particular, no CSS Google Fonts import was added; the accepted fix is deterministic system font fallback variables.

## 10. Files changed

- `app/layout.tsx`
- `app/sitemap.ts`
- `tests/unit/build/current-main-build-safety.test.ts`
- `docs/tickets/ready/STABILIZE-LAUNCH-BUILD-002-current-main-vercel-build-recovery.md`
- `docs/reports/reconciliation/STABILIZE-LAUNCH-BUILD-002-CURRENT-MAIN-VERCEL-BUILD-RECOVERY.md`

## 11. Focused tests

- `git diff --check`: passed.
- `npm test -- --run tests/unit/build/current-main-build-safety.test.ts tests/unit/media-source-safety.test.ts tests/unit/operations/verify-restored-database.test.ts tests/unit/playback-plan-state-messaging.test.ts tests/unit/admin-user-access-actions-ui.test.ts`: passed, 5 files / 36 tests.

## 12. Critical-path regression result

- `npm test -- --run tests/integration/launch-candidate-critical-path.test.ts`: passed, 1 file / 5 tests.

## 13. Backup-verifier regression result

- Included in focused tests: `tests/unit/operations/verify-restored-database.test.ts` passed.

## 14. Final local build result

- `npm run vercel-build`: failed after successful compile/type/lint phases due to missing operator environment variables, not remote font fetching.
- Final failure category: `BLOCKED_OPERATOR_ENV`.
- Required variable names only: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DATABASE_URL`.

## 15. Final Vercel result

- Could not be obtained from this environment because there is no configured Git remote and no Vercel CLI available.
- The safe recorded status is `BLOCKED_OPERATOR_ENV` unless Vercel already has the required variables configured; if configured, Vercel should no longer fail on Google Fonts.

## 16. Required environment variable names only

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `DATABASE_URL`

No values were inspected, printed, committed, or invented.

## 17. Risks

- Exact Google typography is replaced by system/local fallback stacks, so minor visual differences are expected.
- Static legal/not-found prerender still depends on the root client provider tree and therefore requires Clerk public configuration at build time unless a future ticket narrows that route/layout boundary.
- Some non-sitemap static generation/page-data paths still touch DB-backed content when `DATABASE_URL` is absent; this was not changed outside the allowed/supported scope.

## 18. Remaining blockers

- Operator must configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for Vercel/application builds.
- Operator must configure `DATABASE_URL` for Vercel/application builds.
- Live Vercel check inspection requires repository remote/Vercel access not present in this container.

## 19. Next recommended ticket

`STABILIZE-LAUNCH-BUILD-003-static-shell-auth-db-boundary` — narrowly split static informational/not-found shell rendering from auth-dependent client providers and DB-backed home metadata/page-data so `next build` can prerender static shell routes without executing Clerk hooks or DB-backed content, while preserving strict runtime auth/database validation.

## 20. Verdict

`BLOCKED_OPERATOR_ENV`

The deterministic remote Google Fonts build defect is fixed, sitemap generation is safer under DB lookup failure, focused regressions pass, and no fake Clerk key/secret/database URL or business-domain weakening was introduced. The remaining build failure is an explicit operator environment configuration blocker.
