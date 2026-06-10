import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailRepository } from "../infrastructure/email.repository";
import { recordAuditEvent } from "../../audit";
import { EmailError } from "../domain/email.errors";

/**
 * deleteEmailTemplate use case.
 * R9 foundation: Deletes an email template if it's not a system template.
 */
export async function deleteEmailTemplate(
  ctx: AppContext,
  slug: string
): Promise<UseCaseResult<{ success: true }, EmailError>> {
  const repository = new EmailRepository(ctx.prisma);
  const template = await repository.findTemplateBySlug(slug);

  if (!template) {
    return fail(new EmailError('Template not found', 404));
  }

  if (template.isSystem) {
    return fail(new EmailError('Cannot delete system template', 403));
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
