# CORE-INVARIANTS

Status: CANONICAL — ESTABLISHED 2026-06-13

This document records the non-negotiable architectural and product invariants for Polutek.pl. Any implementation deviating from these must be recorded as a risk or architectural drift.

## 1. Domain Invariants (The "DNA")

### 1.1. Payment vs. Access vs. Consent
The system distinguishes three fundamental concepts:
- **Payment:** A financial/money fact (e.g., Stripe PaymentIntent).
- **PatronGrant:** A backend right/status fact (Access).
- **Subscription:** Explicit content-notification consent (Communication).

### 1.2. Access Source of Truth
The **sole backend source of truth** for patron-only access is:
- **`active PatronGrant`**

Access **must NOT** be inferred from:
- `Subscription` (mailing consent).
- `Payment` alone (financial fact).
- `User.isPatron` (denormalized read-model/cache field).
- Clerk metadata or Stripe metadata.
- Frontend state.

`User.isPatron` and Clerk metadata are **READ MODELS / CACHE ONLY**. They must never be the authority for playback gating.

### 1.3. Subscription Source of Truth
- Local database state (`Subscription`, `EmailPreference`) is the **authoritative truth** for consent.
- Resend Audience state is a **projection**.
- Unsubscribing from content notifications **must never** revoke a `PatronGrant`.

## 2. Product Model Invariants

### 2.1. The "Place" Philosophy
- Polutek.pl is a **single-creator place**, not a platform or marketplace.
- It is based on **voluntary creator support** (tips/napiwki).
- It is **not** a recurring paid subscription service.

### 2.2. Qualifying Support
- **Qualifying Minimum:** 10 units of an active currency (PLN, EUR, USD, GBP, CHF).
- **Indefinite Access:** A qualifying tip grants patron access that is indefinite while the service and Patron Zone exist. (Do not use "Lifetime Access" in legal text).

### 2.3. Refund and Dispute Targets
- **Full Refund:** Revokes the linked `PatronGrant`.
- **Open Dispute:** Suspends access.
- **Won Dispute:** Restores access.
- **Lost Dispute/Chargeback:** Revokes access.
- **Partial Refund:** Requires manual review.

## 3. Playback and Media Safety

### 3.1. Gated Resolution
- Provider source resolution (obtaining a playback URL or token) **must follow** a successful backend access check.
- **Denied Playback:** If access is denied or the asset is not ready:
  - Do NOT mount the real player.
  - Do NOT fetch stream/source data.
  - Do NOT request provider playback tokens.
  - Do NOT count playback/view events.
  - Redact `playbackUrl` and `playbackToken` from the API response.

### 3.2. Provider Hierarchy
- **Cloudflare Stream:** Primary provider for private playback.
- **Legacy Storage:** R2, S3, and Vercel Blob are legacy/migration paths and are considered insecure for private patron playback.

## 4. Email and Consent Hardening

- **No Implicit Consent:** Registration, tipping, or receiving a `PatronGrant` does not constitute content-notification consent.
- **System Emails:** System/transactional emails must not alter content-notification preferences or create Resend Audience contacts.
- **Authoritative Local State:** local consent state overrides provider state.
- **Authoritative Identity:** Email identity resolution must be deterministic (User ID first, then Email).
