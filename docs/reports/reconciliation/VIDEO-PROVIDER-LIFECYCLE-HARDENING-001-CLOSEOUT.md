# VIDEO-PROVIDER-LIFECYCLE-HARDENING-001 — Closeout

Status: DONE for ticket scope; public launch remains NO_GO.

## Summary

This closeout repairs the stale unit-test mocks that blocked the previous cleanup from marking `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` done.

## What changed

- Repaired `tests/unit/modules/video/attach-cloudflare-asset.use-case.test.ts` so the mock Prisma client includes `videoAsset.findFirst`, matching `VideoRepository.findAssetByProviderId`.
- Added/kept attach coverage for:
  - pending non-primary Cloudflare asset creation,
  - no fake READY state,
  - same-video idempotency,
  - cross-video UID conflict rejection,
  - ready-primary replacement rejection,
  - invalid UID and missing video failures.
- Repaired `tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts` so the mock Prisma client includes `videoAsset.findFirst` and the missing legacy URL case is isolated from asset-exists cases.
- Added/kept import coverage for:
  - pending non-primary Cloudflare import asset creation,
  - missing legacy URL rejection,
  - existing Cloudflare asset rejection,
  - in-transaction duplicate asset rejection,
  - cross-video UID conflict rejection,
  - admin DTO secrecy.
- Marked `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` as `DONE`.
- Advanced the ready queue to `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001`.

## Validation intent

Expected targeted validation:

```bash
npm test -- --run tests/unit/modules/video/attach-cloudflare-asset.use-case.test.ts \
  tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts \
  tests/unit/modules/video/cloudflare-lifecycle.test.ts \
  tests/unit/video-upload-flow.test.ts
npm run typecheck
npm run lint
npm run build
```

## Remaining launch status

Public launch remains `NO_GO`. This closes only the provider lifecycle hardening ticket. Production/manual evidence, X6/X7 gates and the next publication/hero/sidebar contract remain separate work.
