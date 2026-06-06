# Beta Release Checklist

This checklist defines the gates required to mark the project as "Ready for Private Beta".

## 1. Local Clean Gate
- [ ] `rm -rf node_modules .next`
- [ ] `npm ci`
- [ ] `npx prisma validate` (requires `DATABASE_URL_UNPOOLED` in env)
- [ ] `npx prisma generate`
- [ ] `npm run env:validate:prod`
- [ ] `npm run quality:strict-escapes`
- [ ] `npm run quality:hotspots`
- [ ] `npm run typecheck`
- [ ] `npm test -- --run`
- [ ] `npm run lint`
- [ ] `npm run build`

## 2. DB Gate (Staging/Production)
- [ ] `npx prisma migrate deploy`
- [ ] `npm run db:smoke` (Must pass all columns: `User.isPatron`, `Video.titleEn`, `StripeEvent.status`, etc.)
- [ ] Confirm no Prisma `P2022` errors in logs.

## 3. Staging E2E Gate
- [ ] **Guest Access:**
    - [ ] Homepage loads.
    - [ ] Public video plays.
    - [ ] Logged-in/Patron content blocked.
    - [ ] Subscribe button opens Clerk sign-in.
- [ ] **Authenticated Access:**
    - [ ] Login/Logout works.
    - [ ] Can enable/disable email notifications.
    - [ ] Non-patron blocked from Patron content.
    - [ ] Patron can access Patron content.
    - [ ] Commenting works (tier-gated).
- [ ] **Media Security:**
    - [ ] Exact host allowlist enforced.
    - [ ] Media proxy handles range requests.
    - [ ] HLS/DASH recognized correctly.

## 4. Stripe Gate
- [ ] Success payment creates/updates `Payment` and grants Patron status.
- [ ] Failed payment sets status to `FAILED`.
- [ ] Partial refund updates totals but keeps Patron status.
- [ ] Full refund revokes Patron status (if no other active grants).
- [ ] Lost dispute revokes Patron status and corrects totals.
- [ ] Webhook idempotency verified (duplicate events handled).
- [ ] Clerk metadata synchronized after payment/refund.

## 5. Security Gate
- [ ] `npm audit --audit-level=high` passes.
- [ ] Secret scanning enabled.
- [ ] Media allowlist verified (no subdomain spoofing).
- [ ] Redis/KV rate limiting verified in non-dev environment.

## 6. Release Decision
- **Current Status:** `private beta release candidate`
- **Goal Status:** `ready for private beta`
