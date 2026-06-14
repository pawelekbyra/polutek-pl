# Ticket Queue and Handoff index

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE
Launch status: **NO_GO**

## Canonical Current Ticket

The sole canonical pointer to the current executable ticket is:
[**docs/tickets/ready/README.md**](ready/README.md)

Do NOT use any other pointer in this repository as the source of truth for the active task.

## Queue Structure

- `ready/`: Contains the single current executable ticket and historical merged tickets.
- `blocked/`: Contains tickets waiting for owner decisions, legal review, or upstream repairs.
- `backlog/`: Long-term technical debt and non-launch-critical improvements.

## Rules for Agents

1. Always verify the current ticket ID in `ready/README.md` before starting work.
2. If the current ticket is not what you were assigned, STOP and reconcile.
3. No parallel runtime work on the same module/route family.
4. Every ticket must have a clear exit state and evidence requirement.
