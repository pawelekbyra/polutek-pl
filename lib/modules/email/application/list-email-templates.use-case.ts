import { AppContext } from "../../shared/app-context";
import { EmailTemplateDto } from "../domain/email.dto";
import { UseCaseResult, ok } from "../../shared/result";
import { EmailRepository } from "../infrastructure/email.repository";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS } from "@/lib/email-defaults";

/**
 * listEmailTemplates use case.
 * R9 foundation: returns all email templates from DB and adds missing system defaults.
 */
export async function listEmailTemplates(
  ctx: AppContext
): Promise<UseCaseResult<EmailTemplateDto[], never>> {
  const repository = new EmailRepository(ctx.prisma);
  const templates = await repository.listTemplates();

  const dbSlugs = new Set(templates.map(t => t.slug));
  const allTemplates = [...templates];

  for (const sysSlug of SYSTEM_TEMPLATE_SLUGS) {
    if (!dbSlugs.has(sysSlug)) {
      const defaults = EMAIL_DEFAULTS[sysSlug];
      allTemplates.push({
        id: `sys-${sysSlug}`,
        slug: sysSlug,
        name: `System: ${sysSlug}`,
        description: 'Domyślny szablon systemowy',
        category: 'SYSTEM',
        isSystem: true,
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        ...defaults
      });
    }
  }

  return ok(allTemplates);
}
