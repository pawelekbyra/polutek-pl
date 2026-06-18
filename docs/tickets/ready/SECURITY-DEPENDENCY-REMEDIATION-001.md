# SECURITY-DEPENDENCY-REMEDIATION-001 — Security dependency remediation

Status: READY_FOR_BUILDER
Ticket ID: SECURITY-DEPENDENCY-REMEDIATION-001
Role: Builder
Priority: URGENT
Lane: Security / Dependencies / CI
Type: Fix / Dependency remediation with bounded compatibility migration
Launch: NO_GO
Parallel Safety: SERIAL_ONLY / UNSAFE_WITH_ANY_PACKAGE_JSON_OR_LOCKFILE_WORK

## Goal

Remove all currently visible high/critical npm audit findings using the smallest verified dependency upgrade, apply only the exact compatibility changes proven necessary by GitHub Actions and vendor documentation, and preserve runtime/security behavior without vulnerability suppression or launch-readiness claims.

## Activation and evidence

This ticket was activated after PR #931/#932 restored independent CI visibility and the post-merge reconciliation selected security remediation as the sole executable ticket.

The first Builder attempt correctly returned `BLOCKED_AUDIT_ENDPOINT_UNAVAILABLE` because the local npm audit endpoint returned `403 Forbidden` before any package edit.

Bolek then obtained valid audit evidence and ran a non-merged compatibility simulation in isolated GitHub Actions. Temporary PR #934 was closed without merge and its branch was reset after evidence collection.

Evidence:

- audit baseline run: `27697718247`;
- candidate simulation run: `27698051613`;
- implementation validation run: `27702668049` / CI run `637`;
- temporary diagnostic PR: `#934 — CLOSED / UNMERGED / MUST_NOT_MERGE`;
- Clerk Core 3 upgrade source: `UserButton` sign-out redirect props were removed; redirect must be configured globally, via `SignOutButton`, or programmatically;
- Next 15 upgrade source: request APIs and generated page/route contracts use asynchronous values;
- Vercel preview build for implementation head `f7a0f7b1fb8a3e14bb2ac8053ba92a77d10f1b8d` compiled application code and then failed generated `PageProps` validation on synchronous `params` in `app/admin/users/[userId]/page.tsx`.

## Verified audit baseline

| Field | Verified value |
| --- | --- |
| Severity counts | `info: 0`, `low: 1`, `moderate: 1`, `high: 12`, `critical: 0`, `total: 14` |
| Direct high roots | `next@14.2.35`, `@clerk/nextjs@5.x`, `eslint-config-next@14.2.3` |
| Clerk transitive chain | `@clerk/nextjs` → `@clerk/backend`, `@clerk/clerk-react`, `@clerk/shared`, `js-cookie` |
| ESLint transitive chain | `eslint-config-next` → `@next/eslint-plugin-next` → `glob`; `@typescript-eslint/parser` → `@typescript-eslint/typescript-estree` → `minimatch` |
| Minimum verified Next line | Next advisories require at least `15.5.16`; simulation resolved `15.5.19` |
| Clerk fix | `@clerk/nextjs@7.5.3`, semver-major |
| ESLint config candidate | `eslint-config-next@15.5.16` |

## Verified candidate

Apply exactly:

```txt
next: ^15.5.19
@clerk/nextjs: ^7.5.3
eslint-config-next: 15.5.16
```

Verified simulated audit-after and implementation CI result:

```txt
info: 0
low: 1
moderate: 3
high: 0
critical: 0
total: 4
npm audit --audit-level=high: PASS
```

CI run 637 confirmed `npm audit/security: PASS` on the implementation branch.

Remaining non-high findings must be reported honestly:

- low `esbuild` development-server finding with a fix available;
- moderate `postcss` under Next with no fix available in the simulated graph;
- aggregate moderate entries for direct `next` and `@clerk/nextjs` caused by that transitive `postcss` finding.

Do not claim blanket `SECURITY_PASS` while low/moderate findings remain.

## Verified compatibility work

### Next 15 headers

1. `app/api/webhooks/clerk/route.ts`
   - call `await headers()` exactly once;
   - read the same `svix-id`, `svix-timestamp`, and `svix-signature` values;
   - preserve payload and Svix verification behavior.

2. `lib/utils/correlation.ts`
   - `getCorrelationId()` has a broad synchronous call graph across route handlers, error helpers, and tests;
   - converting it to `async` inside this security ticket would require a large unrelated API-wide migration;
   - use the vendor-documented Next 15 temporary synchronous compatibility cast for the result of `headers()`;
   - preserve the existing synchronous `string | null` contract and fallback behavior;
   - do not edit callers in this ticket;
   - a development warning is expected and must be reported;
   - full async migration is deferred to future `NEXT-ASYNC-REQUEST-API-MIGRATION-001 — PLANNED / NON_EXECUTABLE` and must not become the current queue pointer in this PR.

### Next 15 page and route contracts

The exact additional page and route-handler paths and their mechanical migration rules are defined in:

```txt
docs/tickets/ready/SECURITY-DEPENDENCY-REMEDIATION-001-NEXT15-SCOPE.md
```

That annex is part of this ticket's bound scope. It authorizes only the explicitly listed files. For those files:

- page `params` and `searchParams` must use the Next 15 Promise contract and be awaited once at the page boundary;
- route-handler context `params` must use the Promise contract and be awaited once at the handler boundary;
- existing rendering, redirects, validation, auth/BOLA behavior, HTTP contracts, logging, and side effects must remain unchanged;
- no tests, workflows, schemas, policies, or unrelated files are authorized.

Any path not listed either in this ticket or in the annex requires `BLOCKED_SCOPE_EXPANSION_REQUIRED`.

### Clerk 7

3. `app/components/ClerkLocalizationProvider.tsx`
   - configure the supported global sign-out redirect contract on `ClerkProvider` using `afterSignOutUrl="/"`;
   - preserve all existing localization and sign-in/sign-up redirect props.

4. `app/components/Navbar.tsx`
   - remove unsupported `SignedIn` and `SignedOut` imports/usages;
   - use supported `useUser()` state (`isLoaded`, `isSignedIn`, `user`) for equivalent rendering;
   - do not render signed-in or signed-out controls before Clerk state is loaded;
   - remove unsupported `UserButton.afterSignOutUrl` because redirect is configured globally;
   - preserve admin, patron, sign-in, avatar, and menu behavior.

5. `middleware.ts`
   - replace `(await auth()).protect()` with the Clerk 7-supported `await auth.protect()` contract in the same three branches;
   - preserve public routes, admin protection, comments GET exception, mutation protection, request ID, CSP, request headers, and matcher.

### Next 15 lint/generated changes

6. `app/error.tsx`
   - replace the internal `<a href="/">` with `next/link`;
   - preserve destination, text, styling, and behavior.

7. `next-env.d.ts`
   - accept only the file content generated by Next 15 during typecheck/build;
   - do not add custom declarations manually.

## Parallel safety

This ticket is `SERIAL_ONLY / UNSAFE_WITH_ANY_PACKAGE_JSON_OR_LOCKFILE_WORK`.

No other active branch or agent may change:

- `package.json`;
- `package-lock.json`;
- dependency overrides;
- dependency installation state.

The Builder must confirm this before editing and in the PR report.

## Required preflight

1. Verify the queue still points to this ticket as the exactly one executable ticket.
2. Verify no parallel package/lockfile work exists.
3. Use Node `22.x` from `.nvmrc`.
4. Run `npm ci`.
5. Attempt a fresh `npm audit --json` and compare it with the baseline.
6. Return `BLOCKED_AUDIT_BASELINE_DRIFT` if the direct high roots or required fix thresholds materially changed.
7. If local npm registry/audit access returns `403`, classify it as `BLOCKED_ENVIRONMENT` and use the approved npm-generated lockfile evidence; final security confirmation must come from GitHub Actions.

## Allowed files

The directly allowed files are exactly:

```txt
package.json
package-lock.json
next-env.d.ts
app/api/webhooks/clerk/route.ts
app/components/ClerkLocalizationProvider.tsx
app/components/Navbar.tsx
app/error.tsx
lib/utils/correlation.ts
middleware.ts
```

The additional Next 15 page/route paths are exactly those listed in `SECURITY-DEPENDENCY-REMEDIATION-001-NEXT15-SCOPE.md`.

No other path may change. Any additional required path means:

```txt
BLOCKED_SCOPE_EXPANSION_REQUIRED
```

## Forbidden actions

Do not:

- use `npm audit fix --force`;
- suppress, ignore, silence, or downgrade findings;
- hand-edit dependency trees in `package-lock.json`;
- change workflows, Prisma, migrations, tests, guards, or other control-plane docs;
- change `app/admin/videos/page.tsx`;
- change known stale reconciliation tests;
- fix hotspots or existing coverage debt;
- migrate `next lint` to another command;
- upgrade to Next 16 or beyond Clerk `7.5.x`;
- alter route authorization, BOLA protections, response contracts, or public-route boundaries;
- broaden scope without an Integrator-approved ticket update;
- claim `FULL_CI_PASS`, `PRODUCTION_CERTIFIED`, or `LAUNCH_READY`.

## Implementation requirements

- use the npm-generated `package.json` and `package-lock.json` produced under Node 22;
- apply only the compatibility changes above and in the exact annex;
- preserve webhook verification, authentication, authorization, BOLA checks, request IDs, CSP, public-route boundaries, navigation, and sign-out redirect behavior;
- keep `getCorrelationId()` synchronous using only the documented Next 15 temporary compatibility cast;
- report the expected development warning from synchronous `headers()` access;
- do not modify any caller of `getCorrelationId()`;
- review every page/route migration manually;
- preserve CI visibility restored by PR #931/#932.

## Validation commands

Run and classify every command as `PASS`, `FAIL`, `BLOCKED_ENVIRONMENT`, or `NOT_APPLICABLE`:

```bash
node --version
npm --version
npm ci
npm audit --json > /tmp/npm-audit-after.json
npm audit --audit-level=high
npm run quality:strict-escapes
npm run quality:architecture-boundaries
node scripts/check-control-plane-docs.mjs
npm run typecheck
npm test -- --coverage
npm run lint
npm run build
npm run test:integration:postgres
git diff --check
git diff --name-only
git status --short
```

Additionally verify:

- all three Clerk webhook headers still feed the same verification call;
- all protected middleware branches remain protected;
- public routes and comments GET exception remain unchanged;
- Navbar signed-in/signed-out rendering is equivalent after Clerk state loads;
- sign-out returns to `/` through `ClerkProvider.afterSignOutUrl`;
- `getCorrelationId()` retains its synchronous return type;
- no caller of `getCorrelationId()` changed;
- every annex-listed page awaits `params`/`searchParams` once at its boundary;
- every annex-listed route handler awaits context `params` once at its boundary;
- route parameter names and behavior remain unchanged;
- `next-env.d.ts` was generated by Next;
- changed files are exactly within the direct list plus annex list.

## Definition of Done

- [ ] High and critical findings are zero in GitHub Actions.
- [ ] `npm audit --audit-level=high` passes in GitHub Actions.
- [ ] Remaining low/moderate findings are recorded without suppression.
- [ ] Typecheck, lint, build, strict escapes, architecture boundaries, control-plane docs, and integration-postgres pass.
- [ ] Both connected Vercel preview builds pass.
- [ ] Existing hotspots and coverage failures are reported as pre-existing and not modified.
- [ ] Webhook verification, auth/BOLA boundaries, request ID, CSP, UI state, and sign-out redirect are preserved.
- [ ] No file outside the direct list plus annex list changed.
- [ ] No `getCorrelationId()` caller changed.
- [ ] Parallel Safety is confirmed.
- [ ] Public launch remains `NO_GO`.

## Final report

Include:

- verdict `READY_FOR_INDEPENDENT_REVIEW` or exact `BLOCKED_*`;
- base/head SHA and Node/npm versions;
- Parallel Safety confirmation;
- audit before/after with dependency paths;
- exact package versions before/after;
- compatibility changes per file;
- every validation result;
- GitHub Actions and Vercel preview results;
- expected Next synchronous-header development warning;
- exact changed-file list;
- confirmation that no correlation callers, tests, workflows, Prisma files, or policy contracts changed;
- non-claims;
- `Public launch remains NO_GO`.
