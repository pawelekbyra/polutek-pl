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

Repository search identified the following exact page and dynamic route boundaries using synchronous `params` or `searchParams`.

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
- await the value once at the server-page boundary;
- keep all existing rendering, redirects, query normalization, authorization, and data access unchanged.

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

## Boundaries

- No test files are authorized by this annex.
- No workflow, Prisma, migration, guard, or unrelated application file is authorized.
- Any additional required path means `BLOCKED_SCOPE_EXPANSION_REQUIRED`.
- This annex does not create a second executable ticket.
- Public launch remains `NO_GO`.
