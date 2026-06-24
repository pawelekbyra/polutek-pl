# PR #1096 completion — Patron source contract

Status: DONE

PR #1096 added a focused regression test for the patron video gating source contract.

## What changed

- Added `tests/unit/patron-source-contract.test.ts`.
- The test verifies that the patron-tier branch in `lib/modules/access/application/check-video-access.use-case.ts` calls `getPatronStatus`.
- The test also verifies that the patron-tier branch does not directly read cached user-field properties such as the legacy patron display/cache fields.

## Why this exists

PR #1094 attempted a broad architecture-script guard, but CI showed that approach was too noisy because it matched read-model and DTO field names. PR #1096 replaces that attempt with a narrower source-contract test on the critical video gating path.

## Still open

- A broader architecture/lint guard for backend authorization surfaces is still open.
- This document does not mark the full patron authorization guard workstream complete; it records only the focused #1096 source-contract coverage.
