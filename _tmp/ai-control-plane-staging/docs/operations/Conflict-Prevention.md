# Conflict Prevention

## Strategic Isolation
The most effective way to prevent conflicts is to isolate work by domain (Lane).

## Locks & Protected Files
- **Single-Writer Files:** Documentation files like the Roadmap or the Architecture Blueprint should only be modified by one agent at a time, usually during reconciliation.
- **Protected Files:** `package-lock.json`, `prisma/schema.prisma`, `scripts/check-architecture.ts`, and the root `README.md`/`AGENTS.md` are locked for Builder agents.
- **Guard Lock:** Changes that weaken or modify architecture guards require high-level approval and a dedicated ticket.

## Picking Parallel Tickets
- Ensure tickets do not share the same `Allowed Files`.
- Cross-reference the `Conflicts with` metadata in tickets.
- Prefer running agents in separate modules (e.g., one in `email`, one in `video`).

## Emergency Stop Conditions
- Detection of unplanned overlapping file changes.
- Inconsistent state between the DB schema and the application modules.
- Discovery of shared global state that was not identified during planning.
- Any regression in "Subscription != Patron" or other core product invariants.
