# MEDIA-THUMBNAILS-R2-MIGRATION-001 — Move thumbnail storage from Vercel Blob to Cloudflare R2

Status: IN_PROGRESS — code merged (#1506), ops rollout blocked on owner (see "Rollout status" below)
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

## Rollout status (as of 2026-09-26) — IN PROGRESS, pick up here

Code merged in PR #1506 (squash commit `ab45f59`) and deployed to production;
the `Video.thumbnailPublicUrl` migration ran with that deploy. **Production
behaviour is still unchanged**: thumbnails are served through
`/api/videos/[id]/thumbnail` and admin uploads still go to Vercel Blob, because
the deploy that would pick up the new env vars hasn't happened yet (see below).

### Done

- [x] Code, tests, CLAUDE.md §4.8, cron `/api/cron/sync-public-thumbnails` (PR #1506).
- [x] R2 buckets created via the Cloudflare connector: `polutek-thumbnails`
      (public-to-be) and `polutek-thumbnails-private`. Both ended up in location
      **ENAM** (the connector can't set a location hint; the older `polutek`
      bucket is EEUR). Empty — recreate them with a Europe hint in the dashboard
      if that matters, but only before the first upload.
- [x] Vercel project `polutek.pl` (`prj_e7YawXp53b22uIMsiyW2NkccZgMz`, team
      `team_sc16PptMTGc4ip47phctR79J`), Production + Preview:
      `CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE=polutek-thumbnails-private` and
      `CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC=polutek-thumbnails` added.
      `CLOUDFLARE_R2_ACCOUNT_ID` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` already
      existed (shared with the video-originals bucket).
- [x] The next production deploy, including any push to `main`, activates R2 uploads
      (private bucket, served through the proxy, Blob fallback on R2 errors).
      Public direct serving stays dormant until `NEXT_PUBLIC_R2_PUBLIC_HOST` is set.

### Blockers — need the owner in the Cloudflare dashboard

The Cloudflare connector can only create, list and delete buckets. It cannot
manage API tokens or public access, so these two steps need the dashboard:

1. **R2 token scope unknown, but no longer a deploy risk.** It is not known
   whether the existing R2 API token (the one behind `CLOUDFLARE_R2_ACCESS_KEY_ID`)
   covers the two new buckets, and Vercel's Hobby log retention (1h) doesn't let
   an agent find out after the fact. Since the follow-up PR, both upload routes
   **fall back to Vercel Blob when the R2 write fails**, logging
   `[ADMIN_VIDEO_COVER_UPLOAD_R2_FAILED_FALLING_BACK_TO_BLOB]` /
   `[DEFAULT_VIDEO_THUMBNAIL_R2_FAILED_FALLING_BACK_TO_BLOB]`. Deploying with the
   bucket env vars set is therefore safe. To find out whether R2 actually works,
   upload a cover in the admin and within the hour check the Vercel runtime logs
   for that tag, or check whether the saved `thumbnailUrl` is an
   `r2.cloudflarestorage.com` URL. If it falls back, the token needs Object
   Read & Write on both thumbnail buckets (Cloudflare → R2 → Manage API tokens).
2. **No public host yet.** Enable R2 → `polutek-thumbnails` → Settings →
   Public Development URL, which gives a `pub-<hash>.r2.dev` host. Never enable
   public access on `polutek-thumbnails-private`. A custom subdomain such as
   `thumbs.pawelperfect.pl` is **not** possible right now: `pawelperfect.pl` DNS is
   at home.pl (`dns.home.pl`), and R2 custom domains need the zone on Cloudflare.
   `www.pawelperfect.pl` is the Vercel app itself and must never be used as the R2 host.

### Remaining steps, in order

1. Someone with Cloudflare dashboard access enables the `r2.dev` URL (blocker 2);
   the owner has said they won't go into the dashboard, so this is parked until
   they or someone else can. Without it, thumbnails keep working via the proxy.
2. Set `NEXT_PUBLIC_R2_PUBLIC_HOST=<pub-….r2.dev>` in Vercel (Production + Preview),
   then redeploy production. The `NEXT_PUBLIC_` value is baked into the
   CSP/`next/image` config at build time. Verify that `curl -I https://<host>/`
   responds, the deploy is READY and the home page renders thumbnails.
3. Verify a real upload: an admin uploads a cover, and the object appears in
   `polutek-thumbnails-private`. After publish, a copy appears in
   `polutek-thumbnails`, and `/api/channel/sidebar` returns `https://<host>/…`
   URLs for published videos.
4. Migrate existing Blob thumbnails: `npm run media:migrate-thumbnails-r2` (dry run),
   then `-- --apply`. This needs the production `DATABASE_URL` and R2 credentials,
   which the cloud agent session doesn't have: run it locally, or add those vars
   to the agent environment. Keep the journal JSON. Rollback:
   `-- --rollback=<journal>`.
5. After verifying on the live site, delete the old Blob thumbnails, update the
   "Planned/current migration target" wording in CLAUDE.md §2 and the admin table
   in §5, then move this ticket to `docs/tickets/done/`.

### Known follow-up (not blocking)

- Public thumbnails still go through `next/image` optimisation, so Vercel image
  optimisation fetches from R2 on a cache miss. The thumbnail function is out of
  the path, but the optimiser is not. Possible follow-up: a Cloudflare image
  loader, or `unoptimized` for R2 URLs.
