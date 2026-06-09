import { DbClient } from "../../shared/db";
import { BroadcastAudience, BroadcastRecipientDto } from "../domain/email.dto";

export class EmailRepository {
  constructor(private readonly prisma: DbClient) {}

  async findRecipientsForAudience(audience: BroadcastAudience): Promise<BroadcastRecipientDto[]> {
    if (audience === "TEST") return [];

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
}
