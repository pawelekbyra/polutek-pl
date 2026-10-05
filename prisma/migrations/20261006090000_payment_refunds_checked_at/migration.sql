-- PA-04: remember when a payment's refund total was last reconciled against Stripe (additive, nullable).
ALTER TABLE "Payment" ADD COLUMN "refundsCheckedAt" TIMESTAMP(3);
