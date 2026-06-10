# Lane: Email & Subscriptions

## Purpose
This lane governs the implementation and maintenance of the mailing system, subscriber management, and email notification logic. It ensures that communication with users is reliable, permission-based, and architecturally separated from access control.

## Lane Identity
- **Name:** Email & Subscriptions
- **ID:** LANE-ES
- **Scope:** `lib/modules/email/`, `lib/modules/subscriptions/`, and associated API routes/admin UI components.

## Product Rules
- **Subscription means mailing/follow/notification consent.** It is a signal of interest, not a purchase.
- **Unsubscribe never removes patron access.** Access and interest are independent.
- **Email module sends messages; it does not decide access.** Logic for *who can see what* belongs to the Access module.
- **Auditable actions:** Every broadcast or bulk send action must be recorded in the audit log or a delivery report.

## Subscription != Patron
- **Subscription never grants patron access.** A user can be a subscriber without being a patron.
- **Patron access comes from active PatronGrant only.** Being on a mailing list is not a substitute for a grant.
- **Clarity in UI:** Admin tools and user settings must clearly distinguish between "Subscribed to mailing" and "Patron status".

## Email/Subscriber Concepts
- **Subscriber:** A user who has explicitly opted in to receive updates/newsletters.
- **Patron:** A user with an active PatronGrant. They may or may not be a subscriber.
- **User:** Any registered account.
- **Segments:**
  - `SUBSCRIBERS`: Opted-in users.
  - `PATRONS`: Active access holders.
  - `ALL_USERS`: Everyone in the system (use with caution for transactional/legal notices only).
  - `MANUAL`: A specific, hand-picked list of recipients.

## Owned Paths
- `lib/modules/email/`
- `lib/modules/subscriptions/`
- `app/api/subscriptions/`
- `app/api/admin/emails/`
- `app/api/admin/subscribers/`

## Forbidden by Default
- Modifying `lib/modules/access/` or `lib/modules/payments/`.
- Directly changing `User.isPatron` or `PatronGrant` models.
- Editing global documentation (README, AGENTS.md, etc.) unless explicitly assigned.

## Parallel Safety
- This lane is safe to run alongside **LANE-video-provider** or **LANE-comments**.
- It must be carefully coordinated with **LANE-admin-cockpit** to avoid UI conflicts in the admin panel.

## Work Sequence
1. Inventory of current mailing/subscription code.
2. Hardening of the "Subscription != Patron" invariant in logic and tests.
3. Modularization of email delivery and segment resolution.
4. Implementation of auditable broadcast reports.
5. Final UI/Admin cleanup and certification.

## Suggested Tickets
- **ES-001** Current email/subscription inventory
- **ES-002** Subscription is not patron tests
- **ES-003** Subscriber segment definitions
- **ES-004** Email send/report protocol
- **ES-005** Admin subscribers panel handoff
- **ES-006** Email unsubscribe safety
- **ES-007** Email/subscriptions lane certification

## Validation
- Verify that `unsubscribe` does not affect `PatronGrant`.
- Verify that email segments correctly filter users based on their respective statuses.
- Verify that all bulk email actions produce an audit entry.

## Done Criteria
- Code is modularized within `lib/modules/email` and `lib/modules/subscriptions`.
- No direct Prisma imports in associated API routes.
- Tests confirm Subscription/Patron independence.
- Documentation for the module is updated.

## Certified Criteria
- Full end-to-end verification of subscription flow.
- Admin broadcast functionality verified with audit logs.
- Technical debt in the module is cleared.

## Review Checklist
- Is "Subscription" used anywhere as a synonym for "Patron"?
- Does the email module depend on the Access module instead of the other way around?
- Are raw provider secrets/URLs handled securely?
- Is the UI clear about what "Subscribing" does?

## Anti-patterns
- Using mailing list membership to gate video content.
- Automatically subscribing users to marketing emails without consent upon becoming a Patron.
- Hardcoding recipient lists in the application logic.

## Final Lane Rule
Subscription is about communication. Patron is about access. Keep them separate.
