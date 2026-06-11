# Admin Cloudflare Upload and Import Smoke Test Runbook

## Purpose

This runbook provides the procedure for an administrator to verify that Cloudflare Stream assets can be successfully uploaded or imported, and that their lifecycle states are correctly tracked within the Polutek.pl platform.

## Preconditions

- Authorized Admin account access to the deployed environment.
- Access to the Admin Cockpit (/admin).
- A small, approved test video file (for Path A).
- A video record with a valid legacy `videoUrl` (for Path B).
- Cloudflare Stream is configured in the environment (verified via `docs/operations/cloudflare-stream-webhook-production-check.md`).

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
4. Open the **Media** tab in the video details view.

### 2. Generate Upload URL
1. Locate the Cloudflare Stream section.
2. Click the **"Generuj URL do bezpośredniego przesłania do Cloudflare"** button.
3. Confirm that a `VideoAsset` is created with `provider: CLOUDFLARE_STREAM` and `processingState: PENDING`.

### 3. Upload Media
1. Use the generated upload URL to upload your test video file (e.g., using an API client or a provided admin upload form if available).
2. Confirm the upload completes successfully at the provider level.

### 4. Observe Lifecycle State
1. Refresh the Admin Video Details page.
2. Verify the `processingState` transitions from `PENDING` to `PROCESSING` (triggered by Cloudflare webhook or status sync).
3. Wait for the state to transition to `READY`.
4. Confirm `providerSyncedAt` and `processingEndedAt` are updated.

---

## Path B: Import Existing Legacy URL

### 1. Identify Target Video
1. Find a video that has a valid `videoUrl` (Legacy/Migracja badge) and no existing Cloudflare Stream asset.
2. Open the **Media** tab.

### 2. Trigger Import
1. Click the button **"Importuj do Cloudflare z legacy URL"**.
2. Confirm the system initiates the import and a new Cloudflare `VideoAsset` is attached.
3. Verify that the legacy `videoUrl` remains preserved for audit purposes.

### 3. Prevent Duplicates
1. Attempt to click the import button again for the same video.
2. Verify that the system refuses the duplicate import (Error: `CLOUDFLARE_ASSET_ALREADY_EXISTS`).

### 4. Observe Lifecycle State
1. Observe the `processingState` move to `PROCESSING` and finally `READY`.
2. Confirm that private playback for this video no longer relies on the legacy fallback (if it's a patron-only video).

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
