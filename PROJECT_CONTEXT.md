# PROJECT_CONTEXT.md

## Overview
Paweł Perfect is a video platform inspired by YouTube, built to host exclusive content and support creators through a patron-access model.

## Product Logic
1. **YouTube-style Experience**: The platform is a video-first experience. The homepage features a main highlighted video and a list of other materials.
2. **Channel System**: Currently, there is one primary channel ("polutek"), but the architecture is designed to support multiple creators in the future.
3. **Access Tiers (Paywall)**:
   - `PUBLIC`: Available to everyone.
   - `LOGGED_IN`: Requires a free Clerk account.
   - `PATRON`: Requires a one-time payment meeting the minimum threshold (e.g., 20 PLN / 5 EUR).
4. **Not a Subscription**: The platform does not use recurring subscriptions. Access is granted permanently (Patron status) after a qualifying payment.
5. **Secure Delivery**: All video content is served through a secure gateway (`/api/media/[videoId]`) to prevent direct access to storage URLs and enforce access control.
6. **Community Features**: Supports multi-level comments, likes, and a referral system that can also grant Patron status.

## Guardrails for AI Coders
- **Respect the Paywall**: Any changes to the video player, listing, or API must strictly adhere to the access control policies defined in `AccessPolicy`.
- **Media Security**: Never expose direct storage URLs (`videoUrl`) to the public frontend. Use the `PublicVideoDTO` for all public-facing data.
- **Defensive Rendering**: The UI should handle missing data (e.g., no featured video, empty database) gracefully without crashing.

## Source of truth rules

- Public UI must use `PublicVideoDTO`.
- Public UI must never receive `videoUrl`.
- `/api/media/:videoId` is the only public playback path.
- DB is the source of truth for user role and patron status.
- Clerk metadata is a cache/sync layer, not the primary source of truth.
- Stripe webhook is the source of truth for successful payments.
- Demo fallback content is allowed only in development or when `ENABLE_DEMO_FALLBACKS=true`.

## Patron access policy

Currently, a qualifying one-time payment grants patron access. This should be treated as lifetime patron access unless product requirements change.
