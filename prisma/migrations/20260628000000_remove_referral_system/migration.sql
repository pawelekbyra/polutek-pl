-- Remove referral system (INCOMPLETE-002)
-- Drop Referral table and all referral-related columns from User and PatronGrant

ALTER TABLE "PatronGrant" DROP COLUMN IF EXISTS "referralId";

ALTER TABLE "User" DROP COLUMN IF EXISTS "referralCode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "referralPoints";
ALTER TABLE "User" DROP COLUMN IF EXISTS "referralCount";
ALTER TABLE "User" DROP COLUMN IF EXISTS "referredById";

DROP TABLE IF EXISTS "Referral";

DROP TYPE IF EXISTS "ReferralStatus";
