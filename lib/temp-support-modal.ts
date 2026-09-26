/**
 * TEMPORARY (2026-09-26) — support-flow experiment, owner request. Listed in CLAUDE.md's
 * TEMPORARY CHANGES REGISTRY.
 *
 * While true:
 *  - the tip gate under the sidebar playlist (DonationBox via SidebarPlaylist's PatronBox and
 *    SidebarSupportBox) is hidden — kept in code, not deleted;
 *  - the "Wspieraj"/"Support" button (the `polutek:open-support` event) opens a full-page,
 *    two-step support modal instead: step 1 picks the amount, step 2 is the existing Stripe
 *    CheckoutModal.
 *
 * To revert: set to false. Every branch reads this one constant, so that alone restores the
 * sidebar tip gate and the old "switch to videos tab + scroll to the box" behavior.
 */
export const TEMP_SUPPORT_AS_MODAL = true;
