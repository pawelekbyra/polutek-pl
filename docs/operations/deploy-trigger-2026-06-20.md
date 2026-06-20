# Deploy trigger

This file intentionally triggers a clean Vercel deployment after reverting the broken build commit.

Expected safe base commit before this trigger: `5bc046bd968edf992cb240ea843410dc78702b32`.

The broken build was caused by a temporary `lib/errors.ts` change in a later commit and has been removed from `main`.
