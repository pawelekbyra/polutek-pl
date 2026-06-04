# Known limitations

- Multi-creator support is still limited: the production scenario remains one primary channel, while secondary channels are not treated as a fully productized workflow.
- HLS/DASH transcoding/packaging is not implemented yet; playback is currently served through `/api/media/:videoId` with access checks and range request support for configured media hosts.
- The upload pipeline is not fully finalized and still depends on administrator-provided media/thumbnail URLs from trusted hosts rather than a complete managed upload/transcoding flow.
- The campaign/zrzutka page remains experimental and hidden behind a feature flag.
- Patron status is currently granted by a qualifying one-time donation unless this is changed later.
- Payment totals are tracked per currency for diagnostics/future use.
- Automated unit tests are active and expected to pass after `prisma generate`; broader integration/E2E coverage still requires explicit database and third-party service configuration.
- Demo fallback content must not be used in production unless `ENABLE_DEMO_FALLBACKS=true`.
