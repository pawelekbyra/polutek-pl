# Architecture

## Main flows

* **Public video playback**: Served through `/api/media/:videoId` with no access checks for PUBLIC tier.
* **Registered video playback**: Requires Clerk authentication. Served through gated API.
* **Patron video playback**: Requires `isPatron` status in DB. Served through gated API.
* **Donation to patron**: Handled by Stripe Webhook. Idempotent processing.
* **Referral to patron**: 5 points needed. Synced to Clerk outside transaction.
* **Admin video management**: Restricted to ADMIN role. Soft deletion supported (planned).
* **Hidden campaign page**: Behind `ENABLE_CAMPAIGN_PAGE` feature flag.

## Source of truth

* **Database (Prisma)**: `User.role` and `User.isPatron` are final.
* **Clerk Metadata**: Used as a sync/cache layer for fast frontend checks.
* **Stripe Webhook**: Final authority for payment success.
* **API Gateway**: `/api/media/:videoId` is the only path to video content.

## Important modules

* `AccessPolicy`: Central logic for content access rules.
* `PaymentService`: Stripe integration and fulfillment.
* `ReferralService`: Management of user referrals.
* `UserAccessService`: Synchronization between DB and Clerk.
* `ContentService`: Public-facing data fetching and DTO mapping.
* `/api/media`: Secure range-request supported streaming gateway.
