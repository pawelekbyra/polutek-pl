# Core Product Invariants

Status: PROPOSED_CANONICAL — becomes canonical after Bolek MERGE and repository merge

## 1. Access DNA
- **Payment != PatronGrant != Subscription**
- `Payment`: Financial event (money received).
- `PatronGrant`: Access right truth.
- `Subscription`: Content-notification consent truth.
- **Source of truth for access**: Existence of an active `PatronGrant`.
- `User.isPatron` and Clerk metadata are read-only caches/read-models.

## 2. Patron Eligibility
- Qualifying minimum is **10 units** of an active currency (e.g., 10 PLN, 10 USD, 10 EUR, 10 GBP).
- CHF only when explicitly enabled/active.
- Preferred terminology: `napiwek`, `dobrowolne wsparcie twórcy`. Avoid categorical `darowizna`.

## 3. Grant Lifecycle
- **Full refund**: Normally revokes access (requires targeted revocation).
- **Partial refund**: Requires manual review.
- **Dispute (Open)**: Suspends access.
- **Dispute (Won)**: Restores access.
- **Dispute (Lost/Chargeback)**: Revokes access.
- **Revocation Reasons**: Serious rule violations may justify revocation; criticism alone is NOT a reason.

## 4. Video & Player
- **Allowed PlaybackPlan**: Mount player.
- **Denied PlaybackPlan**: Locked placeholder. No token leakage. No view count.
- **Cloudflare Stream**: Primary production video provider.
- **Legacy Paths**: Vercel Blob, S3, R2 are legacy/migration paths. They are NOT automatically proven active production providers. Bounded context is required before labelling them insecure.

## 5. Comments
- **Read access**: Public for published videos.
- **Write access**: Requires Patron or Admin status.
- **Moderation**: No shadow bans. Every action (hide, delete, restore) must be audited.

## 6. Email & Privacy
- **Subscription**: mailing consent ONLY.
- **Unsubscribe**: Never removes `PatronGrant`.
- **Identity resolution**: deterministic (userId first, then email).
