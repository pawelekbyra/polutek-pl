# Quality Gates — active

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Universal gates

- Scope matches one ticket.
- Forbidden files untouched.
- Validation commands reported honestly.
- Docs do not claim target as current runtime.
- Product invariants preserved.
- No secrets/tokens/PII leaked.
- Follow-up work ticketed, not silently added.

## Runtime gates for future active tickets

- Architecture boundaries pass when relevant.
- Typecheck passes unless documented environment limitation.
- Unit/API tests cover policy and negative cases.
- Security-sensitive paths have denial tests.
- Admin/audit actions have audit tests.

## Docs gates

- `git diff --check`.
- Links/paths accurate.
- Staged vs active status clear.
- Owner decisions consistent across files.
- No runtime implementation hidden in docs PR.
