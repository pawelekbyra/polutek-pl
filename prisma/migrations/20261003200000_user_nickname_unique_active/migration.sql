-- Case-insensitive unique nicknames for active accounts that finished onboarding (audit AUTH-10 / F-11).
-- Until now uniqueness was only a check-then-act in the app, so two parallel requests could take the
-- same nickname. Accounts in onboarding (`onboardingPending`) carry a placeholder name and are left
-- out on purpose: a placeholder must not reserve a nickname.
--
-- 1. Existing duplicates among those accounts: the oldest account keeps the name, the others are
--    sent back through the first-sign-in dialog, exactly what flagNicknameOnboardingIfNeeded()
--    (lib/auth/hooks.ts) does at their next sign-in anyway. No name is changed or deleted.
UPDATE "User" AS u
SET "onboardingPending" = true
FROM (
  SELECT "id", row_number() OVER (PARTITION BY lower("name") ORDER BY "createdAt", "id") AS rn
  FROM "User"
  WHERE "isDeleted" = false AND "onboardingPending" = false AND "name" IS NOT NULL
) AS d
WHERE u."id" = d."id" AND d.rn > 1;

-- 2. The index itself (partial expression index, so it is not in schema.prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "User_name_lower_active_key"
  ON "User" (lower("name"))
  WHERE "isDeleted" = false AND "onboardingPending" = false;
