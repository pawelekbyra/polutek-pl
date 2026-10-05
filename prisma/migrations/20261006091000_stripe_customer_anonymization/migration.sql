-- PA-03: queue of Stripe Customers to anonymize after account deletion (additive: new table only).
CREATE TABLE "StripeCustomerAnonymization" (
    "id" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "userId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeCustomerAnonymization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeCustomerAnonymization_stripeCustomerId_key" ON "StripeCustomerAnonymization"("stripeCustomerId");
CREATE INDEX "StripeCustomerAnonymization_nextAttemptAt_idx" ON "StripeCustomerAnonymization"("nextAttemptAt");
