# PR #1098 completion — legacy patron bridge cleanup

Status: DONE

PR #1098 removed the deprecated patron service bridge after production callers had moved to modular patron use cases.

## What changed

- Removed `lib/services/patron.service.ts`.
- Removed the legacy-only `tests/unit/patron-service.test.ts`.
- Updated `tests/unit/r7-boundary.test.ts` so the removed bridge stays removed.
- Updated `scripts/check-strict-escapes.ts` so baseline entries for deleted files are counted as removed debt rather than stale failures.

## Validation

- GitHub CI for the PR head completed successfully before merge.

## Notes

- This completes the legacy patron bridge removal slice.
- It does not complete the broader architecture/lint guard follow-up for all backend authorization surfaces.
