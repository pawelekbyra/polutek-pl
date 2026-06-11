# Codex Task Prompt Template

```md
You are Codex working in pawelekbyra/kraufanding.

Role: Builder.

Implement exactly one ticket:

<PASTE FULL TICKET>

Rules:
- Follow root AGENTS.md after activation. Before activation, treat `_tmp/ai-control-plane-staging/AGENTS.template.md` only as future template content.
- One ticket = one branch = one PR.
- Modify only Allowed paths.
- Do not modify Forbidden paths.
- Do not expand scope.
- Do not change product policy.
- Do not change runtime if ticket is docs/inventory/spec only.
- Run required validation.
- Commit changes.
- Return PR report.

If blocked, stop and report BLOCKED with unblock condition.
```
