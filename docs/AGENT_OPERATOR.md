# Optional Agent Operator Mode

This document describes an optional operating mode for `pawelekbyra/polutek-pl`.

It is not a replacement for the normal Bolek workflow and it is not a new default rule. It is a convenience mode Paweł may use when he wants Bolek to keep watching the repository without manual prompting, for example when Paweł is away, asleep, or does not want to manually shepherd GitHub/Codex work.

The normal rule remains simple: if something is wrong in code, it should be fixed. The scheduled operator mode is only a way to keep that process moving with less manual prompting.

## Optional automation layers

When Paweł explicitly enables this mode, two cooperating automation paths may be used:

1. **ChatGPT scheduled operator** — periodically reviews GitHub issues and pull requests, checks scope, CI, Vercel feedback, diffs, and mergeability, and performs safe operational actions when available.
2. **Codex Cloud through ChatGPT/GitHub integration** — may handle larger implementation tasks when explicitly triggered with `@codex ...` comments or through Codex UI. This repository does not assume an OpenAI API billing setup or an `OPENAI_API_KEY` secret.

This mode is meant to reduce Paweł's routine prompting burden, not to remove his product ownership or create a separate process.

## When this mode is useful

Use this mode when:

- Paweł wants Bolek to keep checking PRs/issues periodically;
- Paweł wants to leave routine GitHub/CI/PR review work to Bolek for a while;
- Codex may produce PRs while Paweł is not actively watching;
- small scoped fixes can be done directly through connected GitHub tools;
- bigger implementation tasks need a ready Codex prompt.

Do not treat this mode as mandatory. If Paweł is actively working with Bolek in chat, the normal interactive workflow is still valid.

## Operator behavior when enabled

The operator should act proactively and executively, not only advisory, but only within repository guardrails.

The operator may, without asking Paweł for every routine technical step:

- inspect pull requests;
- inspect CI and GitHub Actions;
- inspect Vercel bot comments and deployment status when available;
- read diffs and compare with `main`;
- comment on pull requests;
- prepare scoped prompts for Codex;
- create small scoped branches, commits, or pull requests;
- fix small scoped bugs through available GitHub tools;
- merge a scoped PR when all merge rules below are satisfied.

## Merge rules

The operator may merge without asking Paweł only when all of these are true:

- the PR is narrowly scoped;
- the diff is clean and understandable;
- CI, typecheck, build, and Vercel are green, except for a clearly known external `npm audit/security` condition;
- the PR does not touch forbidden areas listed below;
- the PR does not change public launch status;
- public launch remains `NO_GO`;
- the PR does not introduce broad refactors or unrelated edits;
- the merge tool is available and not blocked by repository permissions.

If write or merge tools are blocked, the operator should report exactly what was checked, what is blocked, and the next concrete command or Codex prompt.

## When to use Codex

Use Codex only for tasks that are too large or too code-heavy for the scheduled operator to complete safely with available GitHub tools.

Prefer this flow:

1. Create or identify a narrow GitHub issue or pull request.
2. Add an operator-reviewed Codex prompt as a GitHub comment.
3. Trigger Codex with `@codex ...` when Codex Cloud is connected for the repository, or give Paweł the exact prompt to paste into Codex UI if direct triggering is not available.
4. Let Codex open or update a PR.
5. Let Bolek review the PR, CI, Vercel, and scope.
6. Merge only if the merge rules are satisfied.

Do not send every issue to Codex automatically. Codex usage is limited and should be conserved for tasks that need it.

Do not add or rely on API-key-based Codex GitHub Actions unless Paweł explicitly enables OpenAI API billing and stores an `OPENAI_API_KEY` secret.

## Codex limits

Paweł uses Codex through ChatGPT Plus, not a paid API setup. Codex has usage windows and limits, including a 5-hour constraint. When Codex cannot run because of quota, capacity, or availability:

- do not keep retriggering it repeatedly;
- mark or describe the work as waiting for Codex capacity;
- complete any safe small part directly if possible;
- leave a ready-to-run Codex prompt in the issue or PR;
- retry in a later operator cycle only when reasonable.

Codex unavailable is not a process failure. It is a waiting state.

## Forbidden areas without explicit need

Do not touch these areas without explicit need and clear justification:

- authentication;
- payments;
- Prisma schema or migrations;
- package manager files, dependency updates, or lockfiles;
- launch certification rules;
- audit/security bypasses;
- public access policy;
- public launch status.

Public launch remains `NO_GO` unless Paweł explicitly changes that decision after production evidence.

## When to ask Paweł

Ask Paweł only when:

- Codex must be used manually in ChatGPT/Codex UI because GitHub comments cannot trigger it;
- write or merge tools are blocked;
- the task moves beyond the current ticket or PR scope;
- a product decision is required and cannot be inferred from the repo;
- the change touches forbidden areas;
- CI/Vercel failure is not clearly unrelated or known;
- a merge would be risky or irreversible.

## Status reporting

When reporting to Paweł, keep it short and concrete:

- what was done;
- current status;
- next concrete step;
- whether Paweł needs to transfer a prompt to Codex or approve a blocked action.

Avoid long technical explanations unless requested.
