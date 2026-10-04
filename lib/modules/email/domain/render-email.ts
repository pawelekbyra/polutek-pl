import { escapeHtml } from "./email-content";
import type { EmailTemplateDefinition } from "./email-template-registry";

/** `{{ name }}` placeholders; the name is what the registry calls a variable key. */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function findPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
  return [...found];
}

export type TemplateVariableProblems = {
  /** Placeholders the template uses that this kind of email does not have. */
  unknown: string[];
  /** Variables this kind of email needs that a language version leaves out. */
  missingRequired: string[];
};

/**
 * Checks every field of a template against its definition. A required variable must appear in the
 * body of each language version that is present (subject alone does not carry a link).
 */
export function validateTemplateVariables(
  definition: EmailTemplateDefinition,
  fields: { subject: string; html: string; subjectEn?: string | null; htmlEn?: string | null },
): TemplateVariableProblems {
  const allowed = new Set<string>(definition.variables);
  const used = new Set<string>([
    ...findPlaceholders(fields.subject),
    ...findPlaceholders(fields.html),
    ...findPlaceholders(fields.subjectEn),
    ...findPlaceholders(fields.htmlEn),
  ]);
  const unknown = [...used].filter((key) => !allowed.has(key)).sort();

  const missing = new Set<string>();
  const bodies = [fields.html, ...(fields.htmlEn ? [fields.htmlEn] : [])];
  for (const key of definition.required) {
    for (const body of bodies) {
      if (!findPlaceholders(body).includes(key)) missing.add(key);
    }
  }
  return { unknown, missingRequired: [...missing].sort() };
}

function substitute(template: string, values: Record<string, string>, encode: (value: string) => string) {
  // An unknown or empty placeholder renders as nothing: never `{{x}}` in front of a recipient.
  return template.replace(PLACEHOLDER, (_, key: string) => encode(values[key] ?? ""));
}

/**
 * HTML body: every value is escaped, so a nickname like `<a href=…>` arrives as text, not markup.
 * URLs are escaped too (`&` → `&amp;` is the correct form inside an href attribute).
 */
export function renderHtml(template: string, values: Record<string, string>): string {
  return substitute(template, values, escapeHtml);
}

/** Subject: plain text for a header, so no escaping, but no line breaks or control characters. */
export function renderSubject(template: string, values: Record<string, string>): string {
  return toHeaderText(substitute(template, values, (value) => value));
}

export function toHeaderText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
