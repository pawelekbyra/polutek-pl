# Ticket: [TITLE]

- **Ticket ID**: [e.g., ES-001]
- **Lane**: [e.g., Email & Subscriptions]
- **Phase**: [e.g., R10-Cleanup]
- **Type**: [Feature/Fix/Refactor/Documentation]
- **Status**: ready
- **Parallel Safety**: [Safe/Unsafe]
- **Conflicts with**: [None/Other Ticket IDs]
- **Can run with**: [None/Other Ticket IDs]
- **Owner role**: Builder

## Goal
[Clear statement of the desired outcome.]

## Context
[Why is this work being done? Any relevant background info.]

## Control-plane provenance
- Source ticket / owner decision: [link]
- Product-policy sources checked: `AGENTS.md`, `docs/strategy/OWNER-DECISIONS.md`, and any cited owner-decision record
- Current queue source checked: `docs/tickets/ready/README.md`
- Launch status impact: [must not claim public-launch readiness without X7 evidence]

## Allowed Files
- `[Path to file or directory]`
- `[Path to file or directory]`

## Forbidden Files
- `README.md`
- `AGENTS.md`
- `package.json`
- `prisma/schema.prisma`
- `[Other sensitive files]`

## Required Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Validation Commands
```bash
# Command to verify the changes
npm run quality:architecture-boundaries
npm test -- path/to/relevant/tests
```

## Semantic preservation checklist
- [ ] Product identity invariants preserved.
- [ ] Payment/access/patron invariants preserved when relevant.
- [ ] Playback safety invariants preserved when relevant.
- [ ] Comments visibility/write-boundary invariants preserved when relevant.
- [ ] Email/subscription consent invariants preserved when relevant.
- [ ] Admin/action/audit requirements preserved when relevant.
- [ ] Ticket does not declare public launch ready without X7 evidence.

## Definition of Done
- [ ] Code is implemented and follows modular standards.
- [ ] No direct Prisma imports in API routes.
- [ ] All validation commands pass.
- [ ] PR report is generated.

## Stop Conditions
- [Condition that should cause the agent to pause and ask for human input.]

## Final Report Requirements
- List of modified files.
- Summary of changes.
- Verification results (logs/screenshots).
