import { AppContext } from '@/lib/modules/shared/app-context';
import { LEGAL_DOCUMENTS_VERSION } from '@/lib/legal/version';

/**
 * Records that the user accepted the current Terms (tip gate checkbox). Only the current version is
 * accepted: a stale client sending an older version records nothing. A user who already accepted
 * this version keeps the original date. Returns whether a new acceptance was written.
 */
export async function recordTermsAcceptance(ctx: AppContext, userId: string, version: string): Promise<boolean> {
  if (version !== LEGAL_DOCUMENTS_VERSION) return false;
  const { count } = await ctx.prisma.user.updateMany({
    where: {
      id: userId,
      isDeleted: false,
      OR: [{ termsVersion: null }, { termsVersion: { not: version } }],
    },
    data: { termsAcceptedAt: ctx.now(), termsVersion: version },
  });
  return count > 0;
}
