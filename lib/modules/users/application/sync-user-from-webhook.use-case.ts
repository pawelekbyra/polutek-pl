import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import crypto from 'crypto';

export interface WebhookUserSyncData {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  language?: string;
  referrerId?: string | null;
}

export class SyncUserFromWebhookUseCase {
  static async execute(ctx: AppContext, data: WebhookUserSyncData): Promise<void> {
    const repository = new UserRepository(ctx.prisma);
    const existingUser = await repository.findById(data.id);

    if (existingUser) {
      await repository.update(data.id, {
        email: data.email,
        name: data.name ?? existingUser.name,
        username: data.username ?? existingUser.username,
        imageUrl: data.imageUrl ?? existingUser.imageUrl,
        language: data.language ?? existingUser.language,
      });
      return;
    }

    await repository.create({
      id: data.id,
      email: data.email,
      name: data.name,
      username: data.username,
      imageUrl: data.imageUrl,
      language: data.language || 'pl',
      referralCode: crypto.randomBytes(6).toString('hex'),
      isPatron: false,
      role: 'USER',
    });

    // Handle referral if present
    if (data.referrerId) {
        const referrer = await repository.findById(data.referrerId);
        if (referrer && referrer.id !== data.id) {
            await (ctx.prisma as any).user.update({
                where: { id: data.id },
                data: {
                    referredBy: { connect: { id: referrer.id } }
                }
            });
        }
    }
  }

  static async softDelete(ctx: AppContext, userId: string): Promise<void> {
    const anonymousId = crypto.randomUUID();

    await (ctx.prisma as any).$transaction(async (tx: any) => {
        // Revoke any active patron grants
        await tx.patronGrant.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date(), reason: 'User deleted' }
        });

        await tx.user.update({
            where: { id: userId },
            data: {
              email: `deleted_${anonymousId}@deleted.com`,
              name: "Usunięty Użytkownik",
              username: `deleted_${anonymousId.split('-')[0]}`,
              imageUrl: null,
              stripeCustomerId: null,
              isPatron: false,
              patronSince: null,
              patronSource: null,
              isDeleted: true
            }
        });

        await recordAuditEvent(ctx, {
            action: 'USER_SOFT_DELETED',
            targetType: 'User',
            targetId: userId
        }, tx);
    });
  }
}
