# Production Evidence Collection Runbook

This runbook provides instructions for operators to collect redacted evidence for production readiness.
Follow these steps to move #956, #1031, and #951 forward.

**WARNING: DO NOT PASTE SECRETS (keys, passwords, tokens) into any issue or document.**

## 1. Deployment & Versioning (Ref: #1031)

### Deployed Commit SHA
- **Action**: Go to Vercel Dashboard -> Project -> Deployments. Find the current 'Production' deployment.
- **Evidence**: Screenshot of the deployment summary showing the Commit SHA and 'Production' label.
- **Redaction**: Redact any custom environment variable names if visible in logs.

### Vercel Production Status
- **Action**: Verify the deployment status is 'Ready'.
- **Evidence**: Screenshot of the deployment status.

## 2. Infrastructure Configuration (Ref: #956)

### Required Config Presence
- **Action**: Run the following command in a secure terminal (where `vercel` CLI is authenticated):
  ```bash
  vercel env pull .env.production
  grep -E "DATABASE_URL|CLERK_PUBLISHABLE_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|MAIN_CREATOR_SLUG" .env.production
  ```
- **Evidence**: List the names of the environment variables that are present.
- **Redaction**: **NEVER paste the values.** Only confirm presence: `DATABASE_URL: PRESENT`.

### MAIN_CREATOR_SLUG Target Proof
- **Action**: Confirm the value of `MAIN_CREATOR_SLUG` matches the intended production channel slug.
- **Evidence**: "Confirmed: MAIN_CREATOR_SLUG matches target channel '...'."

## 3. Content & Domain Readiness (Ref: #956)

### Main Creator Existence
- **Action**: Check the database for the creator record matching `MAIN_CREATOR_SLUG`.
- **Evidence**: `sql SELECT id, slug, isApproved, isPrimary FROM "Creator" WHERE slug = '...';`
- **Redaction**: Provide a redacted screenshot or text output of the query result.

### Homepage & Channel Smoke
- **Action**: Open the production homepage and the main channel page.
- **Evidence**: Screenshots of:
  1. Homepage showing featured/latest videos.
  2. Channel page showing the video grid.

### Public Video Playback Smoke
- **Action**: Play one 'PUBLIC' video as an anonymous user.
- **Evidence**: Screenshot of the video player in 'READY' state playing content.

## 4. Integration Verification (Ref: #951)

### Stripe Webhook Configuration
- **Action**: Go to Stripe Dashboard -> Developers -> Webhooks.
- **Evidence**: Screenshot showing the production URL (https://.../api/webhooks/stripe) and 'Enabled events' including `payment_intent.succeeded`.

### Clerk Webhook Configuration
- **Action**: Go to Clerk Dashboard -> Webhooks.
- **Evidence**: Screenshot showing the production URL (https://.../api/webhooks/clerk) and 'Enabled events' including `user.created`, `user.updated`, `user.deleted`.

### Resend Configuration
- **Action**: Go to Resend Dashboard -> Settings -> API Keys.
- **Evidence**: Confirm an API key is active. (Do not screenshot the key).

## 5. Rollback Plan

### Rollback Steps
- **Action**: In Vercel, go to the previous stable deployment.
- **Evidence**: "Rollback target identified: Deployment ID `...` from `[Date]`."
- **Procedure**:
  1. Select previous deployment.
  2. Click 'Promote to Production'.
  3. Verify status 'Ready'.

---
*Mapped to #956 (Env/Content), #1031 (Evidence Pack), #951 (Certification).*
