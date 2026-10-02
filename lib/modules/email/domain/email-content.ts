/**
 * Pure helpers that turn a template fragment into a message mailbox providers trust more:
 * a complete HTML document (doctype, lang, title, hidden preheader), a hand-made plain-text
 * alternative and a footer that says who the sender is. No I/O, so it is trivially testable.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  zwnj: '',
  rarr: '->',
  larr: '<-',
  mdash: '-',
  ndash: '-',
  hellip: '...',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain-text alternative. Links become "text (url)" so the address is visible, buttons keep their
 * label, block elements become line breaks. Not a general HTML renderer: it only has to cope with
 * the small, hand-written templates this app sends.
 */
export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    // Hidden preheader: it is for the inbox preview only, not part of the readable text.
    .replace(/<div\b[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a\b[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const visible = label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const url = decodeEntities(href).trim();
      if (!url || /^mailto:/i.test(url)) return visible || url.replace(/^mailto:/i, '');
      if (!visible || visible === url) return url;
      return `${visible}\n${url}`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');

  text = decodeEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** Hidden inbox-preview line: the first paragraph of the body, trimmed. */
export function derivePreheader(html: string, max = 110): string {
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return '';
  const text = decodeEntities(match[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export type EmailDocumentInput = {
  /** Template fragment (or a full document, which is returned untouched). */
  html: string;
  language: 'pl' | 'en';
  title: string;
  preheader?: string;
  /** One line saying who sends this mail, shown under the card (physical identity). */
  identityLine: string;
};

const PREHEADER_STYLE =
  'display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;';

export function isFullHtmlDocument(html: string): boolean {
  return /<html[\s>]/i.test(html);
}

/**
 * Wraps a fragment in a complete document. The identity line sits outside the template's own card
 * so admin-edited templates get it too.
 */
export function wrapEmailDocument(input: EmailDocumentInput): string {
  if (isFullHtmlDocument(input.html)) return input.html;

  const preheader = (input.preheader ?? derivePreheader(input.html)).trim();
  const preheaderBlock = preheader
    ? `<div style="${PREHEADER_STYLE}">${escapeHtml(preheader)}${'&nbsp;&zwnj;'.repeat(20)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${input.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#ffffff;">
${preheaderBlock}
${input.html}
<p style="max-width:600px;margin:12px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#777777;text-align:center;">${escapeHtml(input.identityLine)}</p>
</body>
</html>`;
}
