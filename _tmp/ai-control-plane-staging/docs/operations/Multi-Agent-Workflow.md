# Multi-Agent Workflow

Status: STAGED ONLY — NIEAKTYWNE.

## Summary

Owner wybiera batch, Planner sprawdza konflikty, maks 2 Builderów domyślnie, Reviewerzy read-only, Integrator po batchu, Certifier przy bramkach.

## Required flow

1. Start from `OWNER-TIMELINE.md`.
2. Pick one ticket from `docs/tickets/ready/`.
3. Check `Parallel-Work-Matrix.md`.
4. Give Builder exactly one ticket.
5. Review PR with Reviewer protocol.
6. Owner merges only safe PRs.
7. Integrator reconciles after batch.
8. Certifier checks phase gates.

## Hard stops

- No ticket.
- Forbidden paths needed.
- Product policy unclear.
- Same files touched by another active PR.
- Schema/package/guard/global docs required without explicit ticket.
- Validation cannot be run and risk is high.

## Required report

Every role must report status, evidence, validation, blockers, risks and next recommended action.
