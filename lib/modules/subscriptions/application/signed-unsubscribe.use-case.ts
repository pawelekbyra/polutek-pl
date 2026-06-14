import { AppContext } from '@/lib/modules/shared/app-context';
import { flags } from '@/lib/feature-flags';
import { verifyContentUnsubscribeToken } from '../domain/signed-unsubscribe-token';
import { EmailPreferenceRepository } from '../infrastructure/email-preference.repository';

export type SignedUnsubscribeResult = {
  ok: true;
  message: string;
};

const GENERIC_MESSAGE = 'If this link can be processed, content notifications are now disabled.';

export class SignedContentUnsubscribeUseCase {
  static async execute(ctx: AppContext, token: string | null | undefined): Promise<SignedUnsubscribeResult> {
    const verified = verifyContentUnsubscribeToken(token, { now: ctx.now() });
    if (!verified.ok) return { ok: true, message: GENERIC_MESSAGE };

    try {
      await ctx.db.writeTransaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: verified.subject },
          select: { id: true, email: true },
        });
        if (!user?.email) return;

        const mainCreator = flags.mainCreatorSlug
          ? await tx.creator.findUnique({ where: { slug: flags.mainCreatorSlug }, select: { id: true } })
          : null;

        if (mainCreator) {
          await tx.subscription.deleteMany({ where: { userId: user.id, creatorId: mainCreator.id } });
        }

        const preferenceRepo = new EmailPreferenceRepository(tx);
        await preferenceRepo.recordExplicitContentOptOut(user.id, user.email, tx);
      });
    } catch {
      return { ok: true, message: GENERIC_MESSAGE };
    }

    return { ok: true, message: GENERIC_MESSAGE };
  }
}
