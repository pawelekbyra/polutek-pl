import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import type { EmailTemplate } from "@prisma/client";
import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { recordAuditEvent } from "../../audit";
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, type SystemTemplateSlug } from "@/lib/email-defaults";
import { EmailTemplateDto, UpsertEmailTemplateInput } from "../domain/email.dto";
import { EmailError, EmailTemplateNotFoundError, InvalidTemplateVariablesError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";
import {
  describeVariables,
  getTemplateDefinition,
  isSystemTemplateSlug,
  SYSTEM_TEMPLATE_DEFINITIONS,
} from "../domain/email-template-registry";
import { validateTemplateVariables } from "../domain/render-email";

/**
 * Email templates: the texts of system mails live in code (lib/email-defaults.ts). The EmailTemplate
 * table holds only what an admin deliberately saved:
 * - a system slug row with `customizedAt` set overrides that mail; deleting it restores the default;
 * - any other row is an admin-made template used as a starting point for broadcasts.
 * Nothing writes default texts to the database.
 */

export const sanitizeOptions: sanitizeHtml.IOptions = {
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

function defaultDto(slug: SystemTemplateSlug): EmailTemplateDto {
  const definition = SYSTEM_TEMPLATE_DEFINITIONS[slug];
  return {
    id: `default-${slug}`,
    slug,
    name: definition.name,
    description: definition.description,
    isSystem: true,
    isCustomized: false,
    ...EMAIL_DEFAULTS[slug],
    updatedAt: null,
    variables: describeVariables(definition),
  };
}

/** A system row counts only when an admin saved it; a row seeded long ago is ignored. */
function isOverride(row: Pick<EmailTemplate, "customizedAt">) {
  return row.customizedAt !== null;
}

function rowDto(row: EmailTemplate): EmailTemplateDto {
  const system = isSystemTemplateSlug(row.slug);
  const definition = getTemplateDefinition(row.slug);
  return {
    id: row.id,
    slug: row.slug,
    name: system ? SYSTEM_TEMPLATE_DEFINITIONS[row.slug as SystemTemplateSlug].name : row.name,
    description: system ? SYSTEM_TEMPLATE_DEFINITIONS[row.slug as SystemTemplateSlug].description : row.description,
    isSystem: system,
    isCustomized: true,
    subject: row.subject,
    html: row.html,
    subjectEn: row.subjectEn,
    htmlEn: row.htmlEn,
    updatedAt: row.customizedAt ?? row.updatedAt,
    variables: describeVariables(definition),
  };
}

/** Variables an admin-made (broadcast) template may use, for the editor of a new template. */
export function getCustomTemplateVariables() {
  return describeVariables(getTemplateDefinition("custom-template"));
}

/** The template a system mail is sent with: the admin's override if there is one, else null (default). */
export async function findSystemTemplateOverride(ctx: Pick<AppContext, "prisma">, slug: SystemTemplateSlug) {
  const row = await new EmailRepository(ctx.prisma).findTemplateBySlug(slug);
  return row && isOverride(row) ? row : null;
}

function summarizeTemplate(row: Pick<EmailTemplate, "subject" | "html" | "subjectEn" | "htmlEn">) {
  const h = (v: string | null) => (v ? createHash("sha256").update(v).digest("hex").slice(0, 12) : null);
  return { subject: row.subject.slice(0, 120), subjectEn: row.subjectEn?.slice(0, 120) ?? null, htmlSha: h(row.html), htmlLength: row.html.length, htmlEnSha: h(row.htmlEn), htmlEnLength: row.htmlEn?.length ?? 0 };
}

export async function listEmailTemplates(ctx: AppContext): Promise<UseCaseResult<EmailTemplateDto[], never>> {
  const rows = await new EmailRepository(ctx.prisma).listTemplates();
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const system = SYSTEM_TEMPLATE_SLUGS.map((slug) => {
    const row = bySlug.get(slug);
    return row && isOverride(row) ? rowDto(row) : defaultDto(slug);
  });
  const custom = rows.filter((row) => !isSystemTemplateSlug(row.slug)).map(rowDto);
  return ok([...system, ...custom]);
}

export async function getEmailTemplateBySlug(
  ctx: AppContext,
  slug: string,
): Promise<UseCaseResult<EmailTemplateDto, EmailTemplateNotFoundError>> {
  const row = await new EmailRepository(ctx.prisma).findTemplateBySlug(slug);
  if (isSystemTemplateSlug(slug)) {
    return ok(row && isOverride(row) ? rowDto(row) : defaultDto(slug));
  }
  if (!row) return fail(new EmailTemplateNotFoundError(slug));
  return ok(rowDto(row));
}

export async function upsertEmailTemplate(
  ctx: AppContext,
  input: UpsertEmailTemplateInput,
): Promise<UseCaseResult<EmailTemplateDto, EmailError>> {
  const html = sanitizeHtml(input.html, sanitizeOptions);
  const htmlEn = input.htmlEn ? sanitizeHtml(input.htmlEn, sanitizeOptions) : null;
  const previous = await new EmailRepository(ctx.prisma).findTemplateBySlug(input.slug);
  const subjectEn = input.subjectEn?.trim() ? input.subjectEn.trim() : null;

  const problems = validateTemplateVariables(getTemplateDefinition(input.slug), {
    subject: input.subject,
    html,
    subjectEn,
    htmlEn,
  });
  if (problems.unknown.length > 0 || problems.missingRequired.length > 0) {
    return fail(new InvalidTemplateVariablesError(problems));
  }

  const updated = await new EmailRepository(ctx.prisma).saveTemplate({
    slug: input.slug,
    name: isSystemTemplateSlug(input.slug) ? null : input.name ?? null,
    description: isSystemTemplateSlug(input.slug) ? null : input.description ?? null,
    isSystem: isSystemTemplateSlug(input.slug),
    subject: input.subject,
    html,
    subjectEn,
    htmlEn,
    customizedAt: ctx.now(),
  });

  await recordAuditEvent(ctx, {
    action: "TEMPLATE_SAVED",
    targetType: "EmailTemplate",
    targetId: updated.id,
    metadata: {
      slug: updated.slug,
      // Before/after: texts are not copied into the audit log (they can be long), their hashes and lengths are.
      before: previous && isOverride(previous) ? summarizeTemplate(previous) : "default",
      after: summarizeTemplate(updated),
    },
  });

  return ok(rowDto(updated));
}

/**
 * Deletes an admin template. For a system mail this is "restore default": the override row goes and
 * the code default is sent again. Deleting a system mail itself is not possible (it has no row).
 */
export async function deleteEmailTemplate(
  ctx: AppContext,
  slug: string,
): Promise<UseCaseResult<{ success: true; restoredDefault: boolean }, EmailError>> {
  const repository = new EmailRepository(ctx.prisma);
  const row = await repository.findTemplateBySlug(slug);
  if (!row) return fail(new EmailTemplateNotFoundError(slug));

  await repository.deleteTemplate(slug);
  const restoredDefault = isSystemTemplateSlug(slug);

  await recordAuditEvent(ctx, {
    action: restoredDefault ? "TEMPLATE_RESET_TO_DEFAULT" : "TEMPLATE_DELETED",
    targetType: "EmailTemplate",
    targetId: row.id,
    metadata: { slug },
  });

  return ok({ success: true, restoredDefault });
}
