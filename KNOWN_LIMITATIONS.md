# Known limitations

- Multi-creator support is planned but not fully implemented.
- The current production scenario is one primary channel.
- HLS/DASH pipeline is not implemented yet; playback is currently served through `/api/media/:videoId` with access checks and range request support.
- The campaign/zrzutka page is experimental and hidden behind a feature flag.
- Patron status is currently granted by a qualifying one-time donation unless this is changed later.
- Payment totals are tracked per currency for diagnostics/future use.
- Upload pipeline is not fully finalized.
- Automated tests are minimal or not implemented yet.
- Demo fallback content must not be used in production unless `ENABLE_DEMO_FALLBACKS=true`.
