-- Add NON_PATRONS to BroadcastRecipientGroup so a non-patron-only broadcast is recorded
-- accurately in BroadcastEmail.recipientGroup instead of being stored as 'ALL' (which made
-- a non-patron-only send indistinguishable from an all-recipients send in broadcast history).
-- This does not change recipient selection (lib/modules/email/infrastructure/email.repository.ts
-- already filters NON_PATRONS correctly via patronGrants: { none: { revokedAt: null } }) --
-- it only fixes the stored audit-trail label.
ALTER TYPE "BroadcastRecipientGroup" ADD VALUE 'NON_PATRONS';
