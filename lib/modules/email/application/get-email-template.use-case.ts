import { AppContext } from "../../shared/app-context";
import { EmailTemplateDto } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailRepository } from "../infrastructure/email.repository";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from "@/lib/email-defaults";
import { EmailTemplateNotFoundError } from "../domain/email.errors";

/**
 * getEmailTemplateBySlug use case.
 * R9 foundation: returns an email template by slug, or default system template if not found in DB.
 */
export async function getEmailTemplateBySlug(
  ctx: AppContext,
  slug: string
): Promise<UseCaseResult<EmailTemplateDto, EmailTemplateNotFoundError>> {
  const repository = new EmailRepository(ctx.prisma);
  const template = await repository.findTemplateBySlug(slug);

  if (template) {
    return ok(template);
  }

  if (SYSTEM_TEMPLATE_SLUGS.includes(slug as SystemTemplateSlug)) {
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
    });
  }

  return fail(new EmailTemplateNotFoundError(slug));
}
