import { AppContext } from "../../shared/app-context";
import { EmailTemplateDto, UpsertEmailTemplateInput } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
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
 * R9 foundation: validates, sanitizes, and persists email template.
 */
export async function upsertEmailTemplate(
  ctx: AppContext,
  input: UpsertEmailTemplateInput
): Promise<UseCaseResult<EmailTemplateDto, EmailError>> {
  const { html, htmlEn, ...rest } = input;

  const cleanHtml = sanitizeHtml(html, sanitizeOptions);
  const cleanHtmlEn = htmlEn ? sanitizeHtml(htmlEn, sanitizeOptions) : null;

  const repository = new EmailRepository(ctx.prisma);
  const updated = await repository.upsertTemplate({
    ...rest,
    html: cleanHtml,
    htmlEn: cleanHtmlEn,
  });

  await recordAuditEvent(ctx, {
    action: 'TEMPLATE_SAVED',
    targetType: 'EmailTemplate',
    targetId: updated.id,
    metadata: { slug: updated.slug },
  });

  return ok(updated);
}
