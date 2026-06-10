import { AppContext } from "../../shared/app-context";
import { EmailTemplateDto, SaveEmailTemplateInput } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";
import { SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from "@/lib/email-defaults";
import { recordAuditEvent } from "@/lib/modules/audit";
import sanitizeHtml from 'sanitize-html';

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'div', 'h1', 'h2', 'h3', 'br', 'span', 'section', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'img',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['style', 'class'],
    a: ['style', 'class', 'href', 'target', 'rel'],
    img: ['style', 'class', 'src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https'],
  },
};

/**
 * upsertEmailTemplate use case.
 * R9: Saves or updates an email template.
 */
export async function upsertEmailTemplate(
  ctx: AppContext,
  input: SaveEmailTemplateInput
): Promise<UseCaseResult<EmailTemplateDto, EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);

    const cleanHtml = sanitizeHtml(input.html, sanitizeOptions);
    const cleanHtmlEn = input.htmlEn ? sanitizeHtml(input.htmlEn, sanitizeOptions) : null;

    const isSystem = SYSTEM_TEMPLATE_SLUGS.includes(input.slug as SystemTemplateSlug);

    const template = await repository.upsertTemplate({
        ...input,
        html: cleanHtml,
        htmlEn: cleanHtmlEn,
        isSystem
    });

    await recordAuditEvent(ctx, {
      action: 'TEMPLATE_SAVED',
      targetType: 'EmailTemplate',
      targetId: template.id,
      metadata: { slug: template.slug },
    });

    return ok(template);
  } catch (error: any) {
    return fail(new EmailError(error.message || "Failed to save email template"));
  }
}
