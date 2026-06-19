# Launch operator diagnostics runbook (#956/#951)

Status: `NO_GO` until production operator evidence is attached.

This runbook makes the remaining launch blocker executable without changing application runtime behavior. The production app must still fail loudly when required runtime configuration such as `MAIN_CREATOR_SLUG` is missing; a skeleton, digest, 404, or empty channel is not acceptable launch evidence while configuration is broken.

## What this verifies

`npm run launch:diagnose` is a read-only production-content diagnostic. It checks:

- production environment validation, including required runtime variables;
- `MAIN_CREATOR_SLUG` presence;
- the configured creator exists;
- the creator is approved and primary, matching the single-channel domain rule;
- at least one visible `PUBLIC`/`PUBLISHED` video exists for anonymous launch smoke;
- homepage featured/fallback inventory can resolve a public video;
- sidebar/channel inventory can resolve visible content.

The command exits non-zero on any failed check.

## Required operator environment

Run this only from an operator shell that intentionally has the target environment loaded:

```bash
npm run env:validate:prod
npm run launch:diagnose
```

For production evidence, the shell must point at the real production database and production env. Do not paste secrets into issue comments or PRs; attach redacted command output only.

## Expected PASS output

A successful diagnostic prints `[PASS]` for every check, then a summary similar to:

```txt
[PASS] production env validation: Required production environment variables passed application validation.
[PASS] env:DATABASE_URL: DATABASE_URL is present.
[PASS] env:NEXT_PUBLIC_APP_URL: NEXT_PUBLIC_APP_URL is present.
[PASS] env:MAIN_CREATOR_SLUG: MAIN_CREATOR_SLUG is present.
[PASS] main creator exists: Found creator Polutek (polutek).
[PASS] main creator approved: Configured creator is approved.
[PASS] main creator primary: Configured creator is primary.
[PASS] anonymous public video inventory: Found 1 published PUBLIC video(s) for anonymous smoke.
[PASS] homepage featured inventory: Homepage can select public video welcome.
[PASS] sidebar/channel inventory: Sidebar/channel inventory can resolve 1 visible video(s).
```

Even when this passes, public launch remains `NO_GO` until the operator also posts production route/playback smoke evidence for #956/#951.

## Expected FAIL output

Failures are actionable and non-zero. Examples:

```txt
[FAIL] env:MAIN_CREATOR_SLUG: MAIN_CREATOR_SLUG is missing or empty.
       Action: Configure MAIN_CREATOR_SLUG in the production environment.
```

```txt
[FAIL] main creator exists: No Creator row exists for MAIN_CREATOR_SLUG=polutek.
       Action: Create or repair the intended production creator, then rerun diagnostics. Use npm run content:fix:main-creator only if the operator intentionally wants its existing seed/repair behavior.
```

```txt
[FAIL] anonymous public video inventory: No published PUBLIC videos are visible for the configured creator.
       Action: Publish at least one PUBLIC video for the configured creator with publishedAt empty or in the past.
```

A fail result means #956/#951 remain blocked and launch remains `NO_GO`.

## Repair guidance

Prefer explicit admin/database repair of the real intended launch content. Existing commands are still available:

```bash
npm run content:diagnose
npm run content:fix:main-creator
npm run db:seed
```

`content:fix:main-creator` has existing seed/repair behavior and can create/update MVP content. Operators must run it only when they intentionally want that behavior against the currently configured database. After any repair, rerun:

```bash
npm run launch:diagnose
```

## Mapping to #956 and #951

- #956: this runbook and `launch:diagnose` produce auditable evidence for production env/content inventory state instead of relying on ambiguous RSC digest or skeleton observations.
- #951: the checks prove whether the configured main creator and anonymous public video inventory required for production smoke exist.

This does not certify launch. It makes the remaining `NO_GO` blocker clear, repeatable, and hard to misunderstand.
