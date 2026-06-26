import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { normalizePaymentTotals } from "../domain/payment-totals";
import { UserUnauthorizedError, UserNotFoundError } from "../domain/user.errors";

export interface UserSyncStatusDTO {
  totalPaid: number;
  isPatron: boolean;
  language: string;
}

export class SyncCurrentUserUseCase {
  static async execute(ctx: AppContext): Promise<UserSyncStatusDTO> {
    if (ctx.actor.type === 'guest' || ctx.actor.type === 'system') {
      throw new UserUnauthorizedError("Unauthorized: No user ID in context actor");
    }
    const userId = ctx.actor.userId;

    const repository = new UserRepository(ctx.prisma);

    const user = await repository.findWithPaymentTotalsAndActivePatronGrants(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return {
      totalPaid: normalizePaymentTotals(user.paymentTotals as any),
      isPatron: user.patronGrants.length > 0,
      language: user.language || 'pl',
    };
  }
}
