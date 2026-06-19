# SECURITY-DEPENDENCY-REMEDIATION-001 — Next 15 request API scope annex

Status: BOUND_SCOPE_ANNEX
Parent ticket: `SECURITY-DEPENDENCY-REMEDIATION-001`
Launch: `NO_GO`

## Evidence

Implementation CI run `637` and both Vercel previews for head `f7a0f7b1fb8a3e14bb2ac8053ba92a77d10f1b8d` proved that Next 15 package compatibility is not complete until page props and dynamic route context parameters use the asynchronous Next 15 contract.

The first generated build error was:

```txt
app/admin/users/[userId]/page.tsx
Type '{ params: { userId: string; }; }' does not satisfy the constraint 'PageProps'.
The params value must satisfy Promise<any>.
```

The official Next 15 request-API codemod changed exactly the paths listed below. CI run `643` then provided the remaining exact compatibility evidence:

- `app/unsubscribe/page.tsx` must expose only the Promise-based `searchParams` contract;
- `app/api/comments/route.ts` and nine exact tests must call migrated route handlers with `params: Promise.resolve(...)`;
- three historical strict-escape findings moved only because codemod formatting changed their line numbers, so source layout must be restored without changing guard files or adding/removing escape hatches.

## Page files

```txt
app/admin/users/[userId]/page.tsx
app/admin/videos/[id]/page.tsx
app/channel/[slug]/page.tsx
app/page.tsx
app/unsubscribe/page.tsx
```

Migration rule:

- type `params` and/or `searchParams` as `Promise<...>`;
- use `React.use()` for client pages and `await` for server pages;
- resolve the value once at the page boundary;
- keep all existing rendering, redirects, query normalization, authorization, and data access unchanged;
- `app/unsubscribe/page.tsx` must not retain a synchronous-object union in its public page props.

## Dynamic route handlers

```txt
app/api/admin/comments/[commentId]/delete/route.ts
app/api/admin/comments/[commentId]/heart/route.ts
app/api/admin/comments/[commentId]/hide/route.ts
app/api/admin/comments/[commentId]/restore/route.ts
app/api/admin/comments/reports/[reportId]/resolve/route.ts
app/api/admin/users/[userId]/patron/route.ts
app/api/admin/users/[userId]/route.ts
app/api/admin/videos/[id]/actions/route.ts
app/api/admin/videos/[id]/comments/route.ts
app/api/admin/videos/[id]/route.ts
app/api/admin/videos/[id]/upload/route.ts
app/api/comments/[commentId]/context/route.ts
app/api/comments/[commentId]/pin/route.ts
app/api/comments/[commentId]/reaction/route.ts
app/api/comments/[commentId]/replies/route.ts
app/api/comments/[commentId]/report/route.ts
app/api/comments/[commentId]/route.ts
app/api/media-source/[videoId]/route.ts
app/api/media/[...path]/route.ts
app/api/videos/[id]/comments/route.ts
app/api/videos/[id]/playback-event/route.ts
```

Migration rule:

- type route-context `params` as `Promise<...>`;
- await it once at the handler boundary;
- preserve parameter names, HTTP methods, validation, authorization, status codes, response shapes, logging, and side effects.

## Exact caller and test compatibility files

```txt
app/api/comments/route.ts
tests/unit/api-contracts.test.ts
tests/unit/api-route-smoke.test.ts
tests/unit/api/media-proxy-route.test.ts
tests/unit/api/media-source-route.test.ts
tests/unit/api/playback-event-route.test.ts
tests/unit/auth-route-boundaries-dynamic.test.ts
tests/unit/bola-protection.test.ts
tests/unit/comments-route.test.ts
tests/unit/security/launch-security-boundaries.test.ts
```

Migration rule:

- change only the route-handler context arguments from plain objects to `Promise.resolve(existingObject)`;
- preserve every request, assertion, mock, expected status, auth boundary, and business expectation;
- do not weaken or remove tests.

## Strict-escapes line stability

The following historical violations already exist in the approved baseline and must remain at their approved line positions without modifying the baseline guard:

```txt
app/api/admin/videos/[id]/actions/route.ts — existing `as any`
app/api/admin/videos/[id]/comments/route.ts — existing `as any`
app/api/videos/[id]/comments/route.ts — existing `as any`
```

Restore harmless source formatting or multiline signatures so the historical findings retain their baseline line numbers. Do not introduce a new escape hatch and do not edit strict-escape scripts or baseline files.

## Boundaries

- No workflow, Prisma, migration, guard, or unrelated application file is authorized.
- Tests are authorized only for the exact Promise-wrapping changes listed above.
- Any additional required path means `BLOCKED_SCOPE_EXPANSION_REQUIRED`.
- This annex does not create a second executable ticket.
- Public launch remains `NO_GO`.
