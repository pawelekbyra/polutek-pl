# Vercel Main Deployment Incident Report — 2026-06-13

## 1. Incident Details
- **Date**: 2026-06-13
- **Failed Commit SHA**: f729c8068f681bceb28276db5899143dd3631c20
- **Current Main SHA**: f729c8068f681bceb28276db5899143dd3631c20
- **Deployment Type**: Production (Main)
- **Failing Command**: `npm run vercel-build` (specifically `next build` phase)
- **First Meaningful Error**: `Error: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required.`

## 2. Root Cause Analysis
- **Root Cause**: The `ClerkLocalizationProvider` component enforced a strict check for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, throwing a fatal error if it was missing. During the `next build` phase, Next.js attempts to prerender static pages. Since this provider is located in the root layout, it executed for all pages. In environments where this variable is only available at runtime (or missing during build), the entire build failed.
- **Secondary Cause**: `app/sitemap.ts` and several static pages (`/regulamin`, `/polityka-prywatnosci`, `/_not-found`) were being statically generated at build time, triggering database access via Prisma and authentication checks via Clerk's `useUser` hook, both of which require environment variables that might be absent during build.

## 3. Evidence and Reproduction
- **Evidence Sources**:
    - Output of `npm run vercel-build` in the local sandbox.
    - Code inspection of `app/components/ClerkLocalizationProvider.tsx`.
- **Local Reproduction Result**: YES. The build failed consistently with the reported Clerk error.

## 4. Corrective Change
- **Description**:
    - Modified `app/components/ClerkLocalizationProvider.tsx` to log a warning instead of throwing an error when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing, allowing the build to proceed.
    - Explicitly marked `app/sitemap.ts`, `app/polityka-prywatnosci/page.tsx`, `app/regulamin/page.tsx`, and `app/not-found.tsx` with `export const dynamic = 'force-dynamic'`. This ensures these routes are rendered at runtime and do not trigger build-time environment validation crashes.
- **Files Changed**:
    - `app/components/ClerkLocalizationProvider.tsx`
    - `app/sitemap.ts`
    - `app/polityka-prywatnosci/page.tsx`
    - `app/regulamin/page.tsx`
    - `app/not-found.tsx`

## 5. Validation and Verification
- **Validation Commands**:
    - `npm run vercel-build`: **SUCCESS** (Exit code 0)
    - `npm run typecheck`: **SUCCESS** (Exit code 0)
    - `npm run lint`: **SUCCESS** (Exit code 0)
    - `npm run quality:architecture-boundaries`: **SUCCESS** (Exit code 0)
    - `npm test`: **SUCCESS** (684 tests passed)
- **Environment Assumptions**: The fix assumes that `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `DATABASE_URL` are provided at runtime in the production environment.
- **Production Evidence Obtained**: None.
- **Production Evidence Still Missing**: Final confirmation of a successful Vercel production deployment after merge.

## 6. Risk and Rollback
- **Residual Risks**: Specific routes (`/`, `/sitemap.xml`, `/regulamin`, `/polityka-prywatnosci`, `/_not-found`) are now forced to dynamic rendering, which may slightly increase TTFB due to the loss of static optimization, but ensures build stability.
- **Rollback Approach**: `git revert` the fix commit.
- **Post-merge Redeployment Verification Required**: YES.
