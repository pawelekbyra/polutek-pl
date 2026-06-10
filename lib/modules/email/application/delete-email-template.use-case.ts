import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";
import { recordAuditEvent } from "@/lib/modules/audit";

/**
 * deleteEmailTemplate use case.
 * R9: Deletes an email template if it's not a system template.
 */
export async function deleteEmailTemplate(
  ctx: AppContext,
  slug: string
): Promise<UseCaseResult<{ success: boolean }, EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);
    const template = await repository.findTemplateBySlug(slug);

    if (!template) {
        return fail(new EmailError("Template not found", 404, "NOT_FOUND"));
    }

    if (template.isSystem) {
        return fail(new EmailError("Cannot delete system template", 403, "FORBIDDEN"));
    }

    await repository.deleteTemplate(slug);

    await recordAuditEvent(ctx, {
        action: 'TEMPLATE_DELETED',
        targetType: 'EmailTemplate',
        targetId: template.id,
        metadata: { slug },
    });

    return ok({ success: true });
  } catch (error: any) {
    return fail(new EmailError(error.message || "Failed to delete email template"));
  }
}
