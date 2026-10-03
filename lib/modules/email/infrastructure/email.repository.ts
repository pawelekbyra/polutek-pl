import type { EmailTemplate } from "@prisma/client";
import { DbClient } from "../../shared/db";

export type SaveTemplateData = {
  slug: string;
  name: string | null;
  description: string | null;
  isSystem: boolean;
  subject: string;
  html: string;
  subjectEn: string | null;
  htmlEn: string | null;
  customizedAt: Date;
};

export class EmailRepository {
  constructor(private readonly prisma: DbClient) {}

  findTemplateBySlug(slug: string): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findUnique({ where: { slug } });
  }

  listTemplates(): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  }

  saveTemplate(data: SaveTemplateData): Promise<EmailTemplate> {
    const { slug, ...fields } = data;
    return this.prisma.emailTemplate.upsert({
      where: { slug },
      update: fields,
      create: { slug, ...fields },
    });
  }

  async deleteTemplate(slug: string): Promise<void> {
    await this.prisma.emailTemplate.delete({ where: { slug } });
  }
}
