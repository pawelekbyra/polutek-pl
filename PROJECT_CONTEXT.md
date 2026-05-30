# PROJECT_CONTEXT.md

## Overview
POLUTEK.PL is a video platform inspired by YouTube, built to host exclusive content and support creators through a donation-based model.

## Product Logic
1. **YouTube-style Experience**: The platform is a video-first experience. The homepage features a main highlighted video and a list of other materials.
2. **Channel System**: Currently, there is one primary channel ("polutek"), but the architecture is designed to support multiple creators in the future.
3. **Access Tiers (Paywall)**:
   - `PUBLIC`: Available to everyone.
   - `LOGGED_IN`: Requires a free Clerk account.
   - `PATRON`: Requires a one-time donation meeting the minimum threshold (e.g., 20 PLN / 5 EUR).
4. **Not a Subscription**: The platform does not use recurring subscriptions. Access is granted permanently (Patron status) after a qualifying donation.
5. **Secure Delivery**: All video content is served through a secure gateway (`/api/media/[videoId]`) to prevent direct access to storage URLs and enforce access control.
6. **Community Features**: Supports multi-level comments, likes, and a referral system that can also grant Patron status.

## Guardrails for AI Coders
- **Respect the Paywall**: Any changes to the video player, listing, or API must strictly adhere to the access control policies defined in `AccessPolicy`.
- **Media Security**: Never expose direct storage URLs (`videoUrl`) to the public frontend. Use the `PublicVideoDTO` for all public-facing data.
- **Maintain Product Identity**: Do not transform the project into a simple landing page or a traditional crowdfunding site. It must remain a functional VOD platform.
- **Defensive Rendering**: The UI should handle missing data (e.g., no featured video, empty database) gracefully without crashing.
