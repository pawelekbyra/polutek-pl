import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailTemplateDto, UpsertEmailTemplateInput } from "../domain/email.dto";
import { EmailRepository } from "../infrastructure/email.repository";
import { recordAuditEvent } from "../../audit";
import sanitizeHtml from 'sanitize-html';
import { EmailError } from "../domain/email.errors";

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
 * R9 foundation: Creates or updates an email template with HTML sanitization and audit logging.
 */
export async function upsertEmailTemplate(
  ctx: AppContext,
  input: UpsertEmailTemplateInput
): Promise<UseCaseResult<EmailTemplateDto, EmailError>> {
  const repository = new EmailRepository(ctx.prisma);

  const cleanHtml = sanitizeHtml(input.html, sanitizeOptions);
  const cleanHtmlEn = input.htmlEn ? sanitizeHtml(input.htmlEn, sanitizeOptions) : null;

  const template = await repository.upsertTemplate({
    ...input,
    html: cleanHtml,
    htmlEn: cleanHtmlEn,
  });

  await recordAuditEvent(ctx, {
    action: 'TEMPLATE_SAVED',
    targetType: 'EmailTemplate',
    targetId: template.id,
    metadata: { slug: template.slug },
  });

  return ok(template);
}
