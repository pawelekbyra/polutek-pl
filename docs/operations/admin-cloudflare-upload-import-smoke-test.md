# Admin Cloudflare Upload and Import Smoke Test Runbook

## Purpose

This runbook provides the procedure for an administrator to verify that Cloudflare Stream assets can be successfully uploaded or imported, and that their lifecycle states are correctly tracked within the Polutek.pl platform.

## Preconditions

- Authorized Admin account access to the deployed environment.
- Access to the Admin Cockpit (/admin).
- A small, approved test video file (for Path A).
- A video record with a valid legacy `videoUrl` and no attached Cloudflare Stream asset (for Path B).
- Cloudflare Stream is configured in the environment (verified via `docs/operations/cloudflare-stream-webhook-production-check.md`).

**UI note (current as of the distribution-strategy pipeline, see `docs/specs/VIDEO-DISTRIBUTION-PIPELINE.md`):** the admin video Media tab no longer has separate "Generuj URL do bezpośredniego przesłania do Cloudflare" or "Importuj do Cloudflare z legacy URL" buttons — those were replaced by a single distribution-strategy upload flow (`VideoMediaManager.tsx` / `VideoDistributionStrategySelect.tsx` / `ProviderTargetCard.tsx` / `VideoPipelineTimeline.tsx` / `ActivePlaybackRouteCard.tsx`). Path A below is rewritten to match it. Path B's dedicated per-video "import this legacy URL into Cloudflare" action (`import-legacy-to-cloudflare`, in `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts`) is still implemented and reachable through `POST /api/admin/videos/[id]/actions`, but as of this writing has no admin UI button wired to it — confirmed via a repo-wide search that turned up no `.tsx` caller for that action string, only the API route handler. Path B is rewritten below to trigger it directly through that endpoint rather than through a UI button that no longer exists.

## Secret Redaction Rules

- **NEVER** include `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_WEBHOOK_SECRET` in any report or screenshot.
- Redact Cloudflare Asset UIDs (e.g., `uid ...abcd`) to the last 4 characters.
- Redact Video IDs if they are sensitive.

---

## Path A: Direct Upload Workflow

### 1. Navigate to Video Details
1. Log in to the Polutek.pl admin dashboard.
2. Go to the **Filmy** (Videos) section.
3. Select an existing video or create a new test video.
4. Open the **Media** tab in the video details view (renders `VideoMediaManager.tsx`).

### 2. Choose a file and a distribution strategy
1. In the **Wideo** panel, use the file picker (labeled **"Wideo"**, helper text "Wybierz albo upuść plik źródłowy. Oryginał zapisujemy bezpośrednio w R2.") to select your test video file.
2. In the **"Strategia źródeł"** select, choose **"Cloudflare Stream"** (other options: "Auto", "Mux", "Cloudflare + Mux", "Manualnie / zaawansowane" — pick Cloudflare Stream specifically for this smoke test so the run is deterministic).
3. Optionally check **"Opublikuj automatycznie, gdy gotowe"** if you want the video to auto-publish once the source is ready.
4. Click **"Zapisz oryginał i utwórz źródła"**.
5. Confirm the original uploads to R2 (progress % shown while `uploadState.uploading` is true), then a `VideoOriginal` is marked ready and a `VideoDistributionPlan`/`VideoDistributionTarget` is created for Cloudflare Stream with the underlying `VideoAsset.processingState` starting at `PENDING`/`QUEUED`.

### 3. Observe Lifecycle State
1. In the **Status** panel below, the pipeline timeline (`VideoPipelineTimeline.tsx`) shows the Cloudflare Stream target card (`ProviderTargetCard.tsx`) with status text **"Tworzę źródło"** while in progress.
2. Click **"Odśwież"** (calls `POST /api/admin/videos/[id]/reconcile`) to force a provider-status sync instead of only waiting on the webhook; the panel also polls automatically every ~15s while the pipeline is in `CREATING_SOURCES`/`PARTIALLY_READY`.
3. Wait for the target card to show **"Gotowe"** and for the `ActivePlaybackRouteCard` to show the active playback route pointing at this Cloudflare asset.
4. If the target instead shows **"Wymaga interwencji"**, that corresponds to the underlying `processingState: FAILED` — check `target.lastError`/`failureReason` shown under the card.

---

## Path B: Import Existing Legacy URL

There is currently no admin UI button that triggers a per-video legacy-URL-to-Cloudflare import (see the UI note above) — the use case and its `CLOUDFLARE_ASSET_ALREADY_EXISTS` duplicate guard are still implemented and exercised here directly through the API action endpoint that backs the video-detail admin actions.

### 1. Identify Target Video
1. Find a video that has a valid `videoUrl` (Legacy/Migracja badge) and no existing Cloudflare Stream asset.
2. Open the **Media** tab and confirm the pipeline summary shows the `LEGACY_FALLBACK` state ("Film odtwarza się wyłącznie przez starą ścieżkę zapasową (legacy primary asset), bez aktywnej trasy odtwarzania.").

### 2. Trigger Import
1. From an authenticated admin session (browser devtools console on the admin page, or an equivalent authenticated API client), call:
   `POST /api/admin/videos/{videoId}/actions` with JSON body `{"action": "import-legacy-to-cloudflare", "publishAfterAssetReady": false}`.
2. Confirm the response is a successful `AdminVideoDto` and that a new Cloudflare `VideoAsset` is attached to the video.
3. Verify that the legacy `videoUrl` remains preserved for audit purposes.
4. Refresh the admin Media tab and confirm the pipeline timeline now reflects the new Cloudflare target instead of `LEGACY_FALLBACK`.

### 3. Prevent Duplicates
1. Repeat the same `POST /api/admin/videos/{videoId}/actions` call with `"action": "import-legacy-to-cloudflare"` for the same video.
2. Verify that the system refuses the duplicate import (Error: `CLOUDFLARE_ASSET_ALREADY_EXISTS`, HTTP 409 — from `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts`).

### 4. Observe Lifecycle State
1. In the Media tab, observe the new target's status move from **"Tworzę źródło"** to **"Gotowe"** (use the **"Odśwież"** button or wait for the automatic poll, as in Path A).
2. Confirm that private playback for this video no longer relies on the legacy fallback (if it's a patron-only video) — the `ActivePlaybackRouteCard` should show an active route rather than a legacy-fallback notice.

### Bulk alternative
For migrating many legacy videos at once rather than one at a time, `POST /api/admin/videos/distribution-backfill` backfills legacy videos onto the distribution-plan model; it defaults to dry-run and does not enqueue provider jobs unless told not to dry-run (see `docs/specs/VIDEO-DISTRIBUTION-PIPELINE.md`).

---

## Evidence Collection Checklist

For each smoke test, capture the following evidence:

- [ ] **Timestamp**: UTC or local time of the test.
- [ ] **Environment**: Deployed domain (e.g., polutek.pl).
- [ ] **Action**: Path A (Upload) or Path B (Import).
- [ ] **Video ID**: Redacted if sensitive.
- [ ] **Cloudflare Asset UID**: Redacted (last 4 chars).
- [ ] **Initial State**: Evidence of `PENDING`/`UPLOADING`.
- [ ] **Processing State**: Evidence of `PROCESSING`.
- [ ] **Final State**: Evidence of `READY`.
- [ ] **Legacy Preservation**: (For Path B) Confirmation that `videoUrl` still exists.
- [ ] **No Secrets Exposed**: Confirmation that no tokens or private URLs are in the evidence.

## Troubleshooting

- **Stuck in PENDING/PROCESSING**:
    - Check if the Cloudflare Webhook is reaching the production endpoint (`docs/operations/cloudflare-stream-webhook-production-check.md`).
    - Verify `CLOUDFLARE_API_TOKEN` has the correct permissions.
- **Import Failed**:
    - Ensure the legacy URL is publicly reachable by Cloudflare.
    - Check the `failureReason` field in the Admin UI for error messages from Cloudflare.
