# COMMENTS-MODERATION-SPEC: Community and Visibility

Status: ACTIVE

## 1. Permission Matrix

- **Public Read**: Comments on published videos are public.
- **Guest Read**: Public read only.
- **Authenticated Write**: Logged-in users can write on PUBLIC/LOGGED_IN videos.
- **Patron Write**: Writing/Reacting on PATRON videos requires active `PatronGrant` or Admin status.

## 2. Access Integration
- Comment creation/reactions MUST inherit video policy through the `Access` module.
- `canCommentOnVideo(ctx, videoId)` is the mandatory check.

## 3. Moderation and Audit

- Every moderation action (hide, delete, restore, pin) MUST be audited with actor and reason.
- No shadow bans.
- Visibility: Publication status + Moderation status.
- Moderation UI must distinguish between author-deleted and moderator-deleted.

## 4. Required Evidence
- Positive tests: Patron can write on PATRON video.
- Negative tests: Guest/Non-patron cannot write on PATRON video.
- Audit log entry created for each action.
