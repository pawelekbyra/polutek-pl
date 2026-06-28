import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

export class UserAccessService {
  /**
   * Recalculates and updates the user's isPatron status based on active grants.
   * @deprecated Use recalculatePatronStatus use case from @/lib/modules/patron
   */
  static async recalculateUserPatronStatus(userId: string, tx?: DbClient) {
    const { recalculatePatronStatus } = await import('@/lib/modules/patron');
    const { createAppContext } = await import('@/lib/modules/shared/app-context');

    const ctx = createAppContext({ type: 'system', reason: 'legacy_bridge_recalculation' });
    const result = await recalculatePatronStatus(userId, ctx, tx);

    if (!result.ok) {
        throw new Error(result.error.message);
    }

    return {
        isPatron: result.data.isPatron,
        normalizedTotal: result.data.normalizedTotal
    };
  }

}
