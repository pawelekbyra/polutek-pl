import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailRepository } from "../infrastructure/email.repository";
import { recordAuditEvent } from "../../audit";
import { EmailTemplateNotFoundError, SystemTemplateDeleteError, EmailError } from "../domain/email.errors";

/**
 * deleteEmailTemplate use case.
 * R9 foundation: deletes an email template if it's not a system template.
 */
export async function deleteEmailTemplate(
  ctx: AppContext,
  slug: string
): Promise<UseCaseResult<{ success: true }, EmailError>> {
  const repository = new EmailRepository(ctx.prisma);
  const template = await repository.findTemplateBySlug(slug);

  if (!template) {
    return fail(new EmailTemplateNotFoundError(slug));
  }

  if (template.isSystem) {
    return fail(new SystemTemplateDeleteError());
  }

  await repository.deleteTemplate(slug);

  await recordAuditEvent(ctx, {
    action: 'TEMPLATE_DELETED',
    targetType: 'EmailTemplate',
    targetId: template.id,
    metadata: { slug },
  });

  return ok({ success: true });
}
