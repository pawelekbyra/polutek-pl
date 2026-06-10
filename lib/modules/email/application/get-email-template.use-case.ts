import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok } from "../../shared/result";
import { EmailTemplateDto } from "../domain/email.dto";
import { EmailRepository } from "../infrastructure/email.repository";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from "@/lib/email-defaults";

/**
 * getEmailTemplate use case.
 * R9 foundation: Fetches a single email template by slug, with fallback to system defaults.
 */
export async function getEmailTemplate(
  ctx: AppContext,
  slug: string
): Promise<UseCaseResult<EmailTemplateDto | { slug: string; subject: string; html: string }, never>> {
  const repository = new EmailRepository(ctx.prisma);
  const template = await repository.findTemplateBySlug(slug);

  if (!template && SYSTEM_TEMPLATE_SLUGS.includes(slug as SystemTemplateSlug)) {
    const defaults = EMAIL_DEFAULTS[slug as SystemTemplateSlug];
    return ok({
      slug,
      isSystem: true,
      category: 'SYSTEM' as const,
      isActive: true,
      ...defaults
    });
  }

  return ok(template || { slug, subject: '', html: '' });
}
