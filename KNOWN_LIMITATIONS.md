# Known limitations

- Polutek is now strict single-channel: the app is a private creator hub. Multi-creator marketplace support has been removed.
- HLS/DASH transcoding/packaging is not implemented yet; admin-provided HLS (.m3u8) and DASH (.mpd) manifests must come from exact allowed media hosts.
- The upload pipeline is not fully finalized and still depends on administrator-provided media/thumbnail URLs from trusted hosts rather than a complete managed upload/transcoding flow.
- Patron status is currently granted by a qualifying one-time donation or another explicit `PatronGrant` source unless this is changed later.
- `Subscription` is implemented as email notifications / channel follow only. It does not grant premium access and must remain separate from `User.isPatron`.
- Automated unit tests, typecheck and lint pass locally; full E2E smoke coverage still depends on installing Playwright browsers in the environment, and production build requires real Clerk public env.
- Vitest coverage is configured with minimum thresholds (30% Statements/Lines, 25% Branches, 40% Functions) in `vitest.config.ts`.
- Playwright smoke scaffolding exists, but local attempts to install Playwright Chromium can fail when the CDN returns 403; full E2E/screenshot checks must be run in CI/Vercel/staging or another environment with browser access and `E2E_*` state.
- `db:smoke` and `db:migrate:deploy` require real `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; without them local results are environment failures, not release PASS.
- Production rate limiting requires writable Upstash Redis or Vercel KV REST credentials. Memory fallback is allowed only outside production.
- CI is present, but the GitHub-hosted `integration-postgres` and security jobs still need their first real remote run before they can be treated as proven release evidence.
- Demo fallback content is now fail-closed in production: `ENABLE_DEMO_FALLBACKS=true` is honored only outside `NODE_ENV=production`, so real production content must come from the database.
