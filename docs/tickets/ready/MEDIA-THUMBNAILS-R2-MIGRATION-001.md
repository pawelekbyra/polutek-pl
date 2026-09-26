# MEDIA-THUMBNAILS-R2-MIGRATION-001 — Move thumbnail storage from Vercel Blob to Cloudflare R2

Status: CODE_DONE — waiting on ops (see "Rollout" below)
Priority: MEDIUM (cost/scalability; not a correctness bug)

## Why

Thumbnails currently live in Vercel Blob and are streamed through
`/api/videos/[id]/thumbnail`. Since 2026-07-02 the proxy sets `s-maxage`
for published videos, so the Vercel CDN absorbs most repeat traffic — but
every cache miss still costs a function invocation plus Blob egress, which
counts against the Vercel Hobby 100 GB/month transfer limit. R2 has free
egress and the project already carries R2 plumbing (CSP entries,
`MEDIA_BUCKET_HOST` / `NEXT_PUBLIC_R2_PUBLIC_HOST` env, storage service in
`lib/modules/media/infrastructure/`).

## Scope

1. Admin thumbnail upload path writes to R2 (public bucket or bucket behind
   a Cloudflare-proxied custom domain) instead of Vercel Blob.
2. Published videos: serve thumbnail URLs directly from the R2 public host
   (no Vercel function in the path). Keep long-lived immutable caching by
   using content-hashed object keys.
3. Drafts: keep serving through the existing `/api/videos/[id]/thumbnail`
   proxy (admin-only policy stays enforced server-side; R2 public bucket
   must not receive draft thumbnails, or keys must be unguessable and
   swapped on publish).
4. One-off migration script: copy existing Blob thumbnails to R2, update
   `Video.thumbnailUrl` rows, keep Blob values as fallback until verified.
5. Update `ALLOWED_THUMBNAIL_HOSTS` / MediaPolicy allowlists and CLAUDE.md
   §4.8 to describe the new resolution order.

## Invariants that must survive

- Draft thumbnails are never publicly reachable (no public-bucket copies,
  no CDN-cached copies).
- `resolveVideoThumbnailUrl()` keeps returning an absolute URL suitable for
  server-side streaming.
- The default-thumbnail fallback chain (Creator.defaultThumbnailUrl →
  AppSetting blob → null) keeps working.

## Non-goals

- Moving video files (already on Cloudflare Stream).
- Replacing Cloudflare Stream's generated preview frames — custom cover
  images stay the primary thumbnail source.

## Rollout (after the code lands)

Code is done (see CLAUDE.md §4.8). Remaining owner/ops steps, in order:

1. R2 buckets `polutek-thumbnails-private` and `polutek-thumbnails` exist (created 2026-09-26).
   Enable public access on `polutek-thumbnails` **only**: a custom domain
   (recommended, e.g. `thumbs.pawelperfect.pl`) or its `r2.dev` URL.
   `polutek-thumbnails-private` must stay private.
2. R2 API token with Object Read & Write on both thumbnail buckets (the existing
   originals token can be extended instead).
3. Vercel env: `CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE`,
   `CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC`, `NEXT_PUBLIC_R2_PUBLIC_HOST` (the exact
   public host), plus `CLOUDFLARE_R2_ACCOUNT_ID` / `_ACCESS_KEY_ID` /
   `_SECRET_ACCESS_KEY` if not already set. Redeploy (the `NEXT_PUBLIC_` value
   is baked into CSP/`next/image` config at build time).
4. `npm run media:migrate-thumbnails-r2` (dry run), then `-- --apply`. Keep the
   journal JSON and verify thumbnails on the live site.
5. Only then delete the old Blob thumbnails. Then move this ticket to `done/`.
