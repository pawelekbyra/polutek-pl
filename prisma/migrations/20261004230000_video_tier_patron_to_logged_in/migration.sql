-- Owner decision 2026-10-04: videos have two access levels, PUBLIC and LOGGED_IN. PATRON already
-- behaved exactly like LOGGED_IN (sign-in only, a tip unlocks nothing), so this only rewrites the
-- stored value. Idempotent: a second run matches no rows.
--
-- The enum value "AccessTier"."PATRON" stays for now: the running code reads it as LOGGED_IN
-- (lib/access-tier.ts) and VideoPlaybackSession."accessTier" keeps historical values. A later
-- cleanup migration, after this code is deployed, can drop it.
UPDATE "Video" SET "tier" = 'LOGGED_IN' WHERE "tier" = 'PATRON';
