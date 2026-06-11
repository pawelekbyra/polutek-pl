# Ticket: X3-FIX-010-owner-review-legacy-video-migration-checklist

## Info
- **ID:** X3-FIX-010
- **Lane:** Operations
- **Type:** Review/Checklist
- **Goal:** Formalize the owner's review process for the legacy video migration.
- **Parallel Safety:** Yes

## Context
Migration involves potential costs and content curation decisions.

## Requirements
1.  **Create a checklist document for the Human Owner:**
    -   Define criteria for "Archive vs. Migrate".
    -   Space for owner to sign off on Cloudflare usage costs.
    -   Verification steps for content quality post-migration.
2.  **Add to Admin Dashboard:**
    -   Show a "Migration Progress" percentage based on `migrationStatus` readiness.

## Allowed Files
- `docs/operations/**`
- `app/admin/page.tsx` (Dashboard)
- `lib/modules/admin-stats/**`
