/**
 * VAT status of the seller (owner decision 2026-11-02): the sole proprietorship (JDG, start 2027-01-01) is EXEMPT from VAT
 * (subjective exemption up to PLN 240,000 a year), but the code stays ready for crossing the threshold.
 *
 * - `"exempt"` (default): the checkout, terms and receipt say that the price is final and the seller is exempt from VAT.
 *   No VAT amount is shown anywhere.
 * - `"active"`: the previous behaviour: gross prices "including VAT" (23%; the VAT is cut out of the gross price as 23/123).
 *
 * THE AMOUNTS CHARGED (Stripe) ARE THE SAME IN BOTH MODES: the price table (`PATRON_PRICES`) is a final gross price and this
 * switch changes only texts (and the informational `vatRatePercent` of the offer). Never read it in payment code.
 *
 * How to switch (ONE of these):
 *  - edit `VAT_STATUS_DEFAULT` below (one line), or
 *  - set `NEXT_PUBLIC_PLATFORM_VAT_STATUS=active|exempt` in `build.env` of the deploy (deploy.sh passes only NEXT_PUBLIC_* build args;
 *    for a plain local `next build` the name `PLATFORM_VAT_STATUS` works too). It is a BUILD-TIME value (next.config.mjs inlines it
 *    for server and browser alike, so they never disagree), so it needs a new image (deploy).
 * An unknown value means the default. See CLAUDE.md, section "Status VAT".
 */
export type VatStatus = "exempt" | "active";

export const VAT_STATUS_DEFAULT: VatStatus = "exempt";

/** The VAT rate (percent) used when the status is `"active"`. */
export const VAT_ACTIVE_RATE_PERCENT = 23;

export function parseVatStatus(raw: string | null | undefined, fallback: VatStatus = VAT_STATUS_DEFAULT): VatStatus {
  const value = raw?.trim().toLowerCase();
  return value === "active" || value === "exempt" ? value : fallback;
}

/** The status in force. Reads the inlined build-time variable on purpose (a literal `process.env.NEXT_PUBLIC_*` reference, so the browser gets it too). */
export function getVatStatus(): VatStatus {
  return parseVatStatus(process.env.NEXT_PUBLIC_PLATFORM_VAT_STATUS);
}

export function isVatExempt(): boolean {
  return getVatStatus() === "exempt";
}

/** The VAT rate (percent) the offer reports: 0 when the seller is exempt. Informational only; never used to compute a charge. */
export function vatRatePercentFor(status: VatStatus = getVatStatus()): number {
  return status === "active" ? VAT_ACTIVE_RATE_PERCENT : 0;
}
