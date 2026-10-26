/**
 * Switches for finished UI that is hidden on purpose (owner decision 2026-10-14: the per-subscription bell is not needed yet; the header bell stays).
 * The backend stays in place (notification API and fan-out, PATCH /api/subscriptions, Subscription.notify);
 * flipping a flag shows the control again.
 */

/** The per-subscription notification bell (next to "Subscribe" and on the subscriptions page). */
export const SHOW_SUBSCRIPTION_BELL = false;

/** The notification bell with the unread counter next to the avatar in the top bar. */
export const SHOW_NOTIFICATION_BELL = true;

/** The logo shown in the top bar: the POLUTEK.COM wordmark (owner decision 2026-10-26) or the original sunglasses mark. */
export type BrandLogoVariant = "wordmark" | "glasses";

/**
 * Single switch for the header logo. "wordmark" = outlined SVG wordmark (app/components/brand/PolutekWordmark.tsx);
 * "glasses" = the sunglasses image (public/logo-glasses.svg), kept in the code and restorable with this one line
 * (owner: "przywróć okularki" -> set this to "glasses"). Favicon, app icons and the manifest are not affected.
 */
export const BRAND_LOGO_VARIANT: BrandLogoVariant = "wordmark";
