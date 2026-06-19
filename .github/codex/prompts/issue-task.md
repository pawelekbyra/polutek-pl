# Codex issue task prompt

You are working in the `pawelekbyra/polutek-pl` repository.

Use the GitHub issue or pull request context from the workflow event as the task source.

## Operating principles

- Keep the change narrowly scoped.
- Do not perform broad rewrites or unrelated refactors.
- Do not touch auth, payments, Prisma schema/migrations, package manager files, launch certification, audit/security bypasses, public access policy, or public launch status unless the issue explicitly requires it and explains why.
- Public launch remains `NO_GO`.
- Prefer small, reviewable patches.
- Preserve existing tests and architecture boundaries.
- If the task is unsafe, underspecified, or blocked by missing secrets/environment, say so clearly and provide the smallest next step.

## Expected output

Return a concise operator-ready summary:

1. What you changed or recommend changing.
2. Files touched or proposed.
3. Tests/checks run or recommended.
4. Any blockers, including Codex quota/capacity, missing secrets, or environment gaps.
5. Whether this should be a PR, a comment-only finding, or a human decision.

If you modify files in the workflow workspace, keep changes minimal and explain them in the final message.
