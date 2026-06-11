# Reconciliation Report: X3-FIX-006 Legacy Storage Migration Plan

## Executive Summary
This report outlines the strategy for migrating existing video content from legacy storage (S3, R2, Vercel Blob, and direct URLs) to Cloudflare Stream. The goal is to consolidate all private patron-only content into a secure, provider-gated environment while deprecating the use of direct object storage for active playback.

**Core Architectural Invariant:** R2, S3, and Vercel Blob are considered legacy/migration storage paths. They must not be treated as active, safe, private patron playback providers for the long term. All premium content must eventually reside in Cloudflare Stream to benefit from its native signed-token security and adaptive streaming.

## Current Legacy Storage Inventory

### 1. `Video.videoUrl`
- **Description:** A legacy string field in the `Video` model.
- **Patterns Detected:**
  - `https://*.s3.amazonaws.com/*` (AWS S3)
  - `https://*.r2.cloudflarestorage.com/*` (Cloudflare R2)
  - `https://*.public.blob.vercel-storage.com/*` (Vercel Blob)
  - `https://www.youtube.com/*` / `https://youtu.be/*` (External - Safe)
  - `https://vimeo.com/*` (External - Safe)

### 2. `VideoAsset` (Legacy Providers)
- **R2:** Assets stored in Cloudflare R2, currently handled via presigned URLs and gated proxy.
- **S3:** Assets stored in AWS S3, handled similarly to R2.
- **VERCEL_BLOB:** Assets stored in Vercel Blob (private mode).

## Identification Matrix
To identify media requiring migration, use the following criteria in `getAdminVideoDiagnostics`:

| Category | Indicator | Migration Priority |
| :--- | :--- | :--- |
| **Legacy Direct** | `Video.videoUrl` is present AND `Video.asset` is NULL | **HIGH** (Unstructured) |
| **Legacy Asset** | `Video.asset.provider` is `R2`, `S3`, or `VERCEL_BLOB` | **MEDIUM** (Structured but legacy) |
| **Public External** | `videoUrl` contains `youtube.com` or `vimeo.com` | **NONE** (External safe) |
| **Private Insecure**| `tier` is `PATRON` but source is `videoUrl` without proxy | **URGENT** (Security risk) |

## Launch Decision Matrix

| Video Type | Storage Source | Decision |
| :--- | :--- | :--- |
| **Public** | Any (Legacy/External) | Allow legacy fallback; low risk. |
| **Logged-In** | Any (Legacy) | Allow legacy fallback via gated proxy (`/api/media`). |
| **Patron-Only** | **Cloudflare Stream** | **Target State.** Use signed tokens. |
| **Patron-Only** | **Legacy (R2/S3/Blob)** | **Temporary Transition.** Gated proxy only. Migration required. |
| **Missing Asset** | N/A | Show `NO_PRIMARY_ASSET` placeholder. |
| **Processing** | Cloudflare Stream | Show `PROCESSING` placeholder. |
| **Failed Asset** | Cloudflare Stream | Show `UNAVAILABLE` diagnostics. |

## Migration Sequencing to Cloudflare Stream

1.  **Inventory & Diagnostics:** Use `getAdminVideoDiagnostics` to flag all videos missing a `CLOUDFLARE_STREAM` asset.
2.  **Owner Review:** Generate a CSV/Report for the owner to confirm which legacy files are still relevant.
3.  **Original Preservation:** Ensure original high-quality files are kept in R2/S3 until Cloudflare Stream ingest is verified.
4.  **Upload/Import:**
    *   **Option A:** Direct upload via Admin UI.
    *   **Option B (Preferred for Migration):** Use Cloudflare Stream "Link/Import" API to pull from legacy URL.
5.  **Attach Provider Asset:** Record the `providerAssetId` (UID) in a new `VideoAsset` record linked to the `Video`.
6.  **Webhook Verification:** Wait for `READY` state via `handleCloudflareWebhook`.
7.  **Playback Validation:** Test signed-token playback for the new asset.
8.  **Legacy Fallback Disablement:** Once validated, set `isPrimary: true` for the CF asset and eventually clear `videoUrl`.

## Rollback & Preservation Policy
- **Originals:** Legacy storage (R2/S3) will act as the "Cold Archive". Originals should NOT be deleted until 30 days after successful migration and verification.
- **Rollback:** If a Cloudflare asset fails, the system can fallback to the legacy gated proxy if `videoUrl` is still present, but this must trigger a diagnostic warning.

## Explicit Policy Statement
**R2, S3, and Vercel Blob are NOT active private playback providers.**
The current implementation using `/api/media` proxy for these providers is a **security-hardening bridge** intended to prevent raw URL leakage during the migration phase. It is not a scalable or performant solution for high-traffic video delivery.

## Owner Decisions Needed
1.  **Retention Policy:** Should we keep legacy files permanently as backups?
2.  **Migration Budget:** Cloudflare Stream costs vs. legacy storage costs.
3.  **Tier Re-evaluation:** Should any legacy content be made PUBLIC to simplify migration?

## Risks
- **Egress Costs:** Pulling large volumes of data from S3/Vercel Blob to Cloudflare during migration.
- **Processing Failures:** Cloudflare may fail to encode specific legacy codecs.
- **Bandwidth:** The gated proxy (`/api/media`) consumes server-side bandwidth and CPU.

## Validation
- [x] Negative tests in `X3-FIX-005` prove that denied playback does not leak legacy URLs.
- [x] Admin UI already supports basic Cloudflare asset attachment.
- [ ] (Future) Automated inventory script.

## Merge Recommendation
**MERGE** - This plan provides the necessary roadmap for the transition from legacy storage to a secure provider-first model.
