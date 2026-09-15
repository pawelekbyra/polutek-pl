# DEPS-SECURITY-VULN-REMEDIATION-001 — Clear high/critical npm audit findings

Status: READY_FOR_BUILDER
Priority: HIGH (one finding is a critical unauthenticated RCE affecting the
installed framework version; the rest are high-severity transitive deps)

## Why

`npm run audit:high` (the `npm audit/security` CI job) currently fails on
`main`'s own head, independent of any pending PR — confirmed on `main`@`91421fe`
(CI run `34270036876`, job `npm audit/security`). 10 high + 1 critical
vulnerability:

- **critical** — `next` (installed range `9.5.6-canary.0 - 10.0.7 ||
  14.3.0-canary.0 - 15.5.23 || 15.6.0-canary.0 - 16.3.2`): unauthenticated
  remote code execution on Windows-hosted servers, and unauthenticated RCE
  in the Image Optimization API when AVIF files are used
  ([GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36),
  [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)).
  `npm audit`'s own `fixAvailable` says this clears with `next@16.3.5` and is
  **not** a semver-major bump.
- **high** — `sharp` (`<0.35.4`, via `next`'s own dependency): libheif
  vulnerabilities, same `next@16.3.5` fix line.
- **high** — `prisma` / `@prisma/config` (`6.13.0-dev.1 - 8.1.0-dev.4`, via
  `deepmerge-ts` stack exhaustion): `fixAvailable` requires `prisma@6.12.0`
  and is flagged `isSemVerMajor: true` — needs its own validation pass
  (migration/query-behavior check), not a drive-by bump.
- **high** — `browserslist` (`<=4.28.6`): unbounded memory growth / crash via
  untrusted stats. Fix available, non-major (pulled in transitively; check
  what depends on it before forcing a resolution).
- **high** — `express-rate-limit` (`8.0.1 - 8.5.0`, via `ip-address`),
  `fast-uri` (`3.0.0 - 3.1.5`, SSRF/host-confusion), `ip-address` (`<=10.3.0`,
  SSRF via octal/decimal octet confusion), `js-yaml` (`4.0.0 - 4.3.1`, ReDoS),
  `nanoid` (`<3.3.18`, infinite loop on `size: 0`) — all report
  `fixAvailable: true`, likely non-major transitive bumps.

## Scope

1. Bump `next` to `16.3.5` (or later patch clearing both advisories) and
   `sharp` to whatever version that bump pulls in. Run the full build +
   test suite + a manual smoke pass on Image Optimization and any
   Windows-specific concerns (N/A for this Vercel-hosted app, but confirm
   the AVIF path specifically since that's the second advisory).
2. Run `npm audit fix` (not `--force`) first to see how many of the
   remaining high findings (`browserslist`, `express-rate-limit`,
   `fast-uri`, `ip-address`, `js-yaml`, `nanoid`) clear via non-major
   transitive resolution alone.
3. Evaluate the `prisma`/`@prisma/config` major bump (6.x → 8.x) as a
   separate, deliberate migration — Prisma major versions have historically
   changed client generation/query behavior; needs its own PR with full
   migration test coverage, not bundled into a dependency-hygiene sweep.
4. Re-run `npm run audit:high` until it's clean, or document any remaining
   finding that genuinely has no available fix yet with a dated comment in
   this ticket (not a silent CI suppression).

## Invariants that must survive

- No change to Stripe/Clerk/Cloudflare integration behavior from these
  bumps — verify via the full test suite plus a manual checkout/playback
  smoke pass before merging.
- Do not add a blanket `npm audit` severity-level suppression or CI bypass
  to make this job pass — the fix is upgrading the vulnerable packages, not
  hiding the finding.

## Non-goals

- The `prisma` major-version upgrade itself is tracked as a separate
  decision point in this ticket's scope item 3, not required to close this
  ticket if item 1/2 (the `next`/`sharp`/transitive fixes) already clear
  the critical and most of the high findings.
