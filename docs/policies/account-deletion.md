# Account Deletion Policy

This document defines the intended product behavior and contract for account deletion within the Polutek.pl platform.

## Normal Account Deletion (Soft-Delete)

The normal account deletion path, triggered by the Clerk `user.deleted` webhook, uses **soft-delete/anonymization** rather than physical record deletion.

### Goals
- **PII Anonymization:** Personally Identifiable Information (PII) such as email, name, and profile images are neutralized or cleared.
- **Preservation of Discussion:** Public comments and replies are preserved to maintain the integrity of discussion trees. Deleting a user must not cause collateral damage by deleting other users' replies.
- **Consistency:** Counters and historical records remain consistent without requiring complex re-calculation or cascading deletions.

### Implementation Details
- `User.isDeleted` is set to `true`.
- `User.email` is anonymized (e.g., `deleted_{uuid}@deleted.com`).
- `User.name` is set to a neutral label (e.g., "Usunięty Użytkownik").
- `User.username` is anonymized.
- `User.imageUrl` is cleared.
- `User.stripeCustomerId` is cleared.
- `User.isPatron` is set to `false`, and all active `PatronGrant` records are revoked.
- **Subscriptions:** All `Subscription` records for the user are deleted, and the corresponding creators' `subscribersCount` are decremented.
- **Email Preferences:** The user's `EmailPreference` record is deleted to prevent future content notifications.

## Rendering of Anonymized Authors

When a soft-deleted user's comments are rendered:
- The display name must show the neutral "deleted user" label.
- No PII (original email or name) should be exposed.
- The comment text and its place in the discussion tree remain visible.

## Destructive Deletion (Hard-Delete)

Hard-delete (`prisma.user.delete()`) is **not** the normal product path.

- **Operator/Legal Review:** Physical deletion should only be performed following an explicit legal request or administrative review that justifies the destruction of public discussion data.
- **Prisma Cascades:** The Prisma schema contains cascade rules (e.g., `onDelete: Cascade` on `Comment`) that make hard-deletion risky. Direct use of `prisma.user.delete()` will permanently remove all of that user's comments and reactions, potentially breaking discussion threads.
- **Guardrails:** Automated tests ensure that normal application code paths do not accidentally invoke hard-deletion.

## Future Maintenance

Maintainers must:
- Avoid introducing `prisma.user.delete()` in any normal user-facing or webhook-handling workflows.
- Ensure that any new user-related data models follow the anonymization contract if they contain PII.
- Review Prisma cascade paths when modifying the schema to prevent unintended data loss.
