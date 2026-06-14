# COMMENTS-MODERATION-SPEC: Community and Visibility

Status: ACTIVE

## 1. Permission Matrix

- **Public Read**: Comments on published videos are public.
- **Authenticated Write**: Logged-in users can write on PUBLIC/LOGGED_IN videos.
- **Patron Write**: Writing on PATRON videos requires active `PatronGrant` or Admin status.

## 2. Moderation and Audit

- Every moderation action (hide, delete, restore) MUST be audited.
- No shadow bans.
- Visibility state MUST be deterministic.
