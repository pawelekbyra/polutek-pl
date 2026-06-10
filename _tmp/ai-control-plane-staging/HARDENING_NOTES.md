# AI Control Plane Hardening Notes

These notes provide specific guidance for enforcing the multi-agent workflow during and after activation.

## 1. Ticket-Driven Work
- **Constraint**: Builder agents MUST NOT start work without a ticket in `docs/tickets/active/`.
- **Enforcement**: If an agent is prompted without a ticket reference, its first action should be to request a Planner to create one or to create a "Ticket Request" diagnostic report.

## 2. Roadmap vs. Work Source
- **Rule**: The `Active-Execution-Roadmap.md` is for Humans and Planners. It is a status view, not an implementation command.
- **Rule**: Builders implementation logic comes ONLY from the `docs/tickets/active/<id>.md` file.

## 3. Global File Protection (Single-Writer)
- **Files**: `README.md`, `AGENTS.md`, `Active-Execution-Roadmap.md`, `Parallel-Work-Matrix.md`, `Phase-Gates.md`, `scripts/check-architecture.ts`, `prisma/schema.prisma`.
- **Enforcement**: Reviewers must REJECT any Builder PR that modifies these files unless the ticket explicitly lists them in `Allowed Files` (e.g., for Integrator or Schema-locked tasks).

## 4. Reports as Persistent Evidence
- **PR Body**: Is treated as transient metadata.
- **Report Files**: PR reports, Reviews, and Certifications must be saved as files in `docs/reports/` to build a permanent audit trail.

## 5. Certification and Reconciliation
- **Constraint**: Certification of a Phase (e.g., X1) requires a dedicated "Integrator Reconciliation" PR to update docs/guards followed by a "Certifier" PR to mark it complete.
- **Serial Nature**: Certification is always a serial task.

## 6. PR Protocol Enforcement
- PRs must stay within `Allowed Paths`.
- PRs must not implement "Blueprint" target architecture if it conflicts with "Active Roadmap" current cleanup tasks.
