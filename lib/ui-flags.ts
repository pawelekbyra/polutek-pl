/**
 * Switches for finished UI that is hidden on purpose (owner decision 2026-10-14). The backend stays in place
 * (PATCH /api/subscriptions, Subscription.notify); flipping a flag shows the control again.
 */

/** The per-subscription notification bell (next to "Subscribe" and on the subscriptions page). */
export const SHOW_SUBSCRIPTION_BELL = false;
