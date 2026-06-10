import { AppContext } from "../../shared/app-context";
import { EmailTemplateDto } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from "@/lib/email-defaults";

/**
 * listEmailTemplates use case.
 * R9: Lists all email templates from DB and adds missing system defaults.
 */
export async function listEmailTemplates(
  ctx: AppContext
): Promise<UseCaseResult<EmailTemplateDto[], EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);
    const dbTemplates = await repository.listTemplates();

    const dbSlugs = new Set(dbTemplates.map(t => t.slug));
    const allTemplates = [...dbTemplates];

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
            } as EmailTemplateDto);
        }
    }

    return ok(allTemplates);
  } catch (error: any) {
    return fail(new EmailError(error.message || "Failed to list email templates"));
  }
}
