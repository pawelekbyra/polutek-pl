-- Separate the patron-eligibility gate price and the free-amount patron support-box minimum
-- from the technical checkout floor. Both new columns are nullable and fall back to
-- minAmountMinor (checkout floor) when unset, so existing rows keep their current behaviour.
ALTER TABLE "PaymentCurrencySetting" ADD COLUMN "patronThresholdMinor" INTEGER;
ALTER TABLE "PaymentCurrencySetting" ADD COLUMN "patronBoxMinMinor" INTEGER;
