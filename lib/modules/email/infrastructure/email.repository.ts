import { DbClient } from "../../shared/db";
import { BroadcastAudience, BroadcastRecipientDto, AdminBroadcastEmailListItemDto, EmailTemplateDto, SaveEmailTemplateInput } from "../domain/email.dto";

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

  async findTemplateBySlug(slug: string): Promise<EmailTemplateDto | null> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug }
    });
    return template ? (template as EmailTemplateDto) : null;
  }

  async listTemplates(): Promise<EmailTemplateDto[]> {
    const templates = await this.prisma.emailTemplate.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return templates as EmailTemplateDto[];
  }

  async upsertTemplate(data: SaveEmailTemplateInput & { isSystem?: boolean }): Promise<EmailTemplateDto> {
    const template = await this.prisma.emailTemplate.upsert({
      where: { slug: data.slug },
      update: {
        name: data.name,
        description: data.description,
        category: data.category,
        isActive: data.isActive,
        subject: data.subject,
        html: data.html,
        subjectEn: data.subjectEn,
        htmlEn: data.htmlEn,
      },
      create: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category,
        isActive: data.isActive,
        isSystem: data.isSystem || false,
        subject: data.subject,
        html: data.html,
        subjectEn: data.subjectEn,
        htmlEn: data.htmlEn,
      }
    });
    return template as EmailTemplateDto;
  }

  async deleteTemplate(slug: string): Promise<void> {
    await this.prisma.emailTemplate.delete({
      where: { slug }
    });
  }
}
