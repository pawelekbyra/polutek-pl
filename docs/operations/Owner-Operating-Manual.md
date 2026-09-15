# Owner Operating Manual

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Summary

Owner nie zleca vague tasks. Owner wybiera ticket, uruchamia Buildera, potem Reviewera, merge tylko po MERGE, Integrator po batchu, Certifier przy gates.

## Required flow

1. Start from `docs/README.md` (documentation index) and this manual.
2. Pick one ticket from `docs/tickets/ready/`.
3. Check `docs/tickets/active/` and `docs/tickets/blocked/` for tickets already in flight or blocked, to avoid two builders touching the same files. (Note: this step used to say "check `Parallel-Work-Matrix.md`" — that file never existed in this repo and no equivalent parallel-work-tracking doc has replaced it; the ticket-queue subfolders above are the closest current signal.)
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
