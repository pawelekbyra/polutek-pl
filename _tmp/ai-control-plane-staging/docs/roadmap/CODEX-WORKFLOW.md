# Codex Workflow — owner manual

Status: STAGED ONLY — NIEAKTYWNE.

## Golden rule

```txt
one ticket = one Codex task = one branch = one PR
```

## Owner flow

1. Choose ticket from `docs/tickets/ready/`.
2. Start Codex with full ticket content.
3. Codex creates branch and PR.
4. Reviewer AI reviews PR.
5. Owner merges only if verdict is `MERGE`.
6. Integrator moves ticket and updates roadmap if needed.
7. Certifier checks phase gates.
8. Repeat.

## Forbidden prompts

Do not ask Codex: `continue`, `improve everything`, `build the app`, `do next phase`, `refactor all`, `finish roadmap`.

Always give a ticket.

## Builder prompt skeleton

```md
You are Codex in pawelekbyra/kraufanding.

Role: Builder.

Implement exactly one ticket:

<PASTE docs/tickets/ready/TICKET.md>

Rules:
- Follow root AGENTS.md after activation. Before activation, treat `_tmp/ai-control-plane-staging/AGENTS.template.md` only as a future template.
- Edit only Allowed paths from the ticket.
- Do not edit Forbidden paths.
- Do not expand scope.
- Run required validation.
- Commit changes on this branch.
- Return the required PR report.

If blocked, stop and report BLOCKED with unblock condition.
```

## Reviewer prompt skeleton

```md
Role: Reviewer.
Review this PR diff against ticket <ticket-id> and root AGENTS.md after activation; before activation, use `AGENTS.template.md` only as a staged future template.
Return verdict: MERGE, FIX, BLOCKED, or REJECT.
Check scope, forbidden files, validation, product invariants and risks.
```
