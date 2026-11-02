/**
 * Switches for finished UI that is hidden on purpose (owner decision 2026-10-14: the per-subscription bell is not needed yet; the header bell stays).
 * The backend stays in place (notification API and fan-out, PATCH /api/subscriptions, Subscription.notify);
 * flipping a flag shows the control again.
 */

/** The per-subscription notification bell (next to "Subscribe" and on the subscriptions page). */
export const SHOW_SUBSCRIPTION_BELL = false;

/** The notification bell with the unread counter next to the avatar in the top bar. */
export const SHOW_NOTIFICATION_BELL = true;

/**
 * The logo shown in the top bar: the blue POLUTEK wordmark redrawn from the owner's image (2026-11-02), the older POLUTEK lockup
 * with the play badge, or the original sunglasses mark.
 */
export type BrandLogoVariant = "wordmark-blue" | "wordmark" | "glasses";

/**
 * Single switch for the header logo. "wordmark-blue" = the blue POLUTEK lettering, one path (app/components/brand/PolutekWordmarkBlue.tsx,
 * colour token --brand-ink = #01286a), live since 2026-11-02 on the owner's explicit order; "wordmark" = the older lockup with the
 * play badge (PolutekWordmark.tsx, frozen 2026-10-27); "glasses" = the sunglasses image (public/logo-glasses.svg).
 * All three stay in the code: back to the glasses is one line (owner: "przywroc okularki" -> set this to "glasses").
 * Favicon, app icons and the manifest are not affected (they stay the glasses).
 */
export const BRAND_LOGO_VARIANT: BrandLogoVariant = "wordmark-blue";
