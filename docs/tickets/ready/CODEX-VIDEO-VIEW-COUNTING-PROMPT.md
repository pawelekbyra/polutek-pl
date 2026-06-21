# Codex prompt: backend video view counting hardening

Work on repository `pawelekbyra/polutek-pl`.

Context: branch `fix/video-view-counting` fixes Cloudflare Stream frontend tracking so the iframe player emits `WATCHED_10_SECONDS`. Backend view counting still needs durable write-path idempotency.

Task:

1. Inspect `lib/modules/video/application/record-playback-event.use-case.ts` and `lib/modules/video/infrastructure/video-playback.repository.ts`.
2. Update the final view write path so one playback session can increment views at most once, even if duplicate `WATCHED_10_SECONDS` events arrive concurrently.
3. Implement this by claiming the session inside the existing write transaction before creating `VideoView` and incrementing `Video.views`.
4. If the claim fails because `countedAsView` is already true, do not create another `VideoView` and do not increment `Video.views`.
5. Add or update tests proving duplicate ten-second events for the same session are idempotent.
6. Keep admin preview exclusion unchanged.
7. Do not store raw playback URLs, signed URLs, tokens, cookies, or authorization material in analytics metadata.

Suggested shape:

- In `VideoPlaybackRepository.recordView`, call `videoPlaybackSession.updateMany` with `where: { id: sessionId, countedAsView: false }` and `data: { countedAsView: true }`.
- Continue only if `count === 1`.
- Then create `VideoView` and increment `Video.views`.
- Return a boolean such as `true` when counted and `false` when skipped.

Validation:

- Run `npm run typecheck`.
- Run `npm test -- --run tests/unit/modules/video/record-playback-event.use-case.test.ts`.
- Run any affected playback-event route tests.
