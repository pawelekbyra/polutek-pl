import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok } from "../../shared/result";
import { EmailTemplateDto } from "../domain/email.dto";
import { EmailRepository } from "../infrastructure/email.repository";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from "@/lib/email-defaults";

/**
 * listEmailTemplates use case.
 * R9 foundation: Fetches all email templates and ensures system defaults are included.
 */
export async function listEmailTemplates(
  ctx: AppContext
): Promise<UseCaseResult<EmailTemplateDto[], never>> {
  const repository = new EmailRepository(ctx.prisma);
  const dbTemplates = await repository.findAllTemplates();

  const dbSlugs = new Set(dbTemplates.map(t => t.slug));
  const allTemplates = [...dbTemplates];

  for (const sysSlug of SYSTEM_TEMPLATE_SLUGS) {
    if (!dbSlugs.has(sysSlug)) {
      const defaults = EMAIL_DEFAULTS[sysSlug as SystemTemplateSlug];
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
      } as EmailTemplateDto);
    }
  }

  return ok(allTemplates);
}
