-- Add editable displayed subscriber override for channels.
ALTER TABLE "Creator" ADD COLUMN "displaySubscribersCount" INTEGER;

-- Add editable minimum tip amounts per currency.
CREATE TABLE "PaymentCurrencySetting" (
    "currency" TEXT NOT NULL,
    "minAmountMinor" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCurrencySetting_pkey" PRIMARY KEY ("currency")
);

CREATE INDEX "PaymentCurrencySetting_updatedAt_idx" ON "PaymentCurrencySetting"("updatedAt");

INSERT INTO "PaymentCurrencySetting" ("currency", "minAmountMinor", "updatedAt") VALUES
  ('PLN', 2000, CURRENT_TIMESTAMP),
  ('EUR', 500, CURRENT_TIMESTAMP),
  ('USD', 500, CURRENT_TIMESTAMP),
  ('CHF', 500, CURRENT_TIMESTAMP),
  ('GBP', 500, CURRENT_TIMESTAMP)
ON CONFLICT ("currency") DO NOTHING;

-- Normalize legacy main channel slug to the requested public slug.
UPDATE "Creator"
SET "slug" = 'polutek'
WHERE "slug" = 'main-creator'
  AND NOT EXISTS (SELECT 1 FROM "Creator" WHERE "slug" = 'polutek');
