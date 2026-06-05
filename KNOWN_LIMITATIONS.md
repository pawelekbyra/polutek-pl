# Known limitations

- Multi-creator support is still limited: the production scenario remains one configured creator, while open creator onboarding/discovery is not productized.
- HLS/DASH transcoding/packaging is not implemented yet; playback is currently served through `/api/media/:videoId` with access checks and range-request support for configured media hosts.
- The upload pipeline is not fully finalized and still depends on administrator-provided media/thumbnail URLs from trusted hosts rather than a complete managed upload/transcoding flow.
- The campaign/zrzutka page remains experimental and hidden behind a feature flag.
- Patron status is currently granted by a qualifying one-time donation or another explicit `PatronGrant` source unless this is changed later.
- `Subscription` is implemented as email notifications / channel follow only. It does not grant premium access and must remain separate from `User.isPatron`.
- Automated unit tests (25 files / 136 tests), typecheck and lint pass locally, but full E2E smoke coverage still depends on installing Playwright browsers in the environment.
- Coverage script and minimum thresholds are still not configured; a local attempt to install `@vitest/coverage-v8@4.1.7` was blocked by registry `403 Forbidden`, so coverage hardening must continue in CI or another environment with package access.
- Local attempts to install Playwright Chromium can fail when the CDN returns 403; in that case E2E/screenshot checks must be run in CI or another environment with browser access.
- `db:smoke` and `db:migrate:deploy` require real `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; without them local results are environment failures, not release PASS.
- Production rate limiting requires writable Upstash Redis or Vercel KV REST credentials. Memory fallback is allowed only outside production.
- CI is present, but the GitHub-hosted `integration-postgres` and security jobs still need their first real remote run before they can be treated as proven release evidence.
- Demo fallback content must not be used in production unless `ENABLE_DEMO_FALLBACKS=true` is an explicit operational decision.
