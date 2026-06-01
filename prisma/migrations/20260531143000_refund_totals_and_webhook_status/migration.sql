-- Track refund totals idempotently on payments.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0;

-- Rename the shared webhook idempotency enum to a neutral name.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StripeEventStatus')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookEventStatus') THEN
    ALTER TYPE "StripeEventStatus" RENAME TO "WebhookEventStatus";
  END IF;
END $$;
