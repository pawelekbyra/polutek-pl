import { DbClient } from "../../shared/db";
import { BroadcastAudience, BroadcastRecipientDto, AdminBroadcastEmailListItemDto } from "../domain/email.dto";

export class EmailRepository {
  constructor(private readonly prisma: DbClient) {}

  async findRecipientsForAudience(audience: BroadcastAudience): Promise<BroadcastRecipientDto[]> {
    if (audience === "TEST" || audience === "MANUAL") return [];

    let where: any = { isDeleted: false };

    if (audience === "PATRONS") {
      where.isPatron = true;
    } else if (audience === "NON_PATRONS") {
      where.isPatron = false;
    } else if (audience === "ALL_SUBSCRIBERS") {
      where.subscriptions = { some: {} };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        language: true,
        name: true,
        isPatron: true,
      }
    });

    return users.map(u => ({
      userId: u.id,
      email: u.email,
      name: u.name,
      isPatron: u.isPatron,
      language: u.language || 'pl',
    }));
  }

  async listBroadcastHistory(): Promise<AdminBroadcastEmailListItemDto[]> {
      const history = await this.prisma.broadcastEmail.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20
      });

      return history.map(h => ({
          id: h.id,
          subjectPl: h.subjectPl,
          status: h.status,
          recipientGroup: h.recipientGroup,
          recipientCount: h.recipientCount,
          sentCount: h.sentCount,
          errorCount: h.errorCount,
          sentAt: h.sentAt,
          createdAt: h.createdAt,
          createdById: h.createdById
      }));
  }
}
