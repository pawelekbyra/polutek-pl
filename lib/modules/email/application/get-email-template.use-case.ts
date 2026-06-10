import { AppContext } from "../../shared/app-context";
import { EmailTemplateDto } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from "@/lib/email-defaults";

/**
 * getEmailTemplate use case.
 * R9: Gets an email template by slug, falling back to system defaults if not in DB.
 */
export async function getEmailTemplate(
  ctx: AppContext,
  slug: string
): Promise<UseCaseResult<EmailTemplateDto | null, EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);
    const template = await repository.findTemplateBySlug(slug);

    if (!template && SYSTEM_TEMPLATE_SLUGS.includes(slug as SystemTemplateSlug)) {
        const defaults = EMAIL_DEFAULTS[slug as SystemTemplateSlug];
        return ok({
            id: `sys-${slug}`,
            slug,
            name: `System: ${slug}`,
            description: 'Domyślny szablon systemowy',
            category: 'SYSTEM',
            isSystem: true,
            isActive: true,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            ...defaults
        } as EmailTemplateDto);
    }

    return ok(template);
  } catch (error: any) {
    return fail(new EmailError(error.message || "Failed to get email template"));
  }
}
