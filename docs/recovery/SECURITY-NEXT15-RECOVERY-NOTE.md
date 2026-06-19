# Security and Next 15 recovery note

Status: RECOVERY_DRAFT
Launch: NO_GO

This branch restores the preserved post-PR-944 recovery tree onto a new branch targeting `main`.

Recovered source commit:

```txt
2efce5d700cca4c4c79609057aaf640d257d3f6d
```

This branch is intentionally a draft recovery PR. It must not be merged until independent CI/review confirms the remaining Next 15 compatibility work is complete.

Known context:

- The prior stacked PRs were closed before the final flow was completed.
- Codex could not regenerate dependency files because npm registry access for `@clerk/nextjs` returned `403 Forbidden`.
- The recovery branch therefore reuses the preserved dependency-generated tree from the old PR #944 merge ref instead of hand-editing `package-lock.json`.
- The old PR #944 tree was not fully green; typecheck, build, and strict-escapes previously needed follow-up fixes.

Required follow-up before merge:

- verify `npm audit --audit-level=high` passes;
- verify strict-escapes passes;
- verify typecheck passes;
- verify build passes;
- verify architecture boundaries, control-plane docs, lint and integration-postgres pass;
- confirm public launch remains `NO_GO`.

Non-claims:

- This note does not claim FULL_CI_PASS.
- This note does not claim SECURITY_PASS.
- This note does not claim PRODUCTION_CERTIFIED.
- This note does not claim LAUNCH_READY.
