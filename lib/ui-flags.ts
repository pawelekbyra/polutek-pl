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
 * EXPERIMENT (prototype, easy to revert): navigation between the service's sections (Video, Photos, Shop):
 * a rounded bottom bar on phones, a slim rail on desktops, and the demo pages /zdjecia (/en/photos) and
 * /sklep (/en/shop). `false` hides the whole navigation and makes both new routes answer 404.
 */
export const SHOW_SECTION_NAV = true;
