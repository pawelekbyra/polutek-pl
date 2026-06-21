import sanitizeHtml from "sanitize-html";

const sanitizeEmailPreviewOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "div",
    "h1",
    "h2",
    "h3",
    "br",
    "span",
    "section",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "ul",
    "ol",
    "li",
    "img",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["style", "class"],
    a: ["style", "class", "href", "target", "rel"],
    img: ["style", "class", "src", "alt", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
    img: ["http", "https"],
  },
};

export function sanitizeEmailPreviewHtml(html: string | null | undefined): string {
  return sanitizeHtml(html ?? "", sanitizeEmailPreviewOptions);
}
