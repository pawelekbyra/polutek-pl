import { previewEmailTemplate } from "@/lib/modules/email";
import { panelRouteContext, unauthorizedJson } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

const field = (fd: FormData, key: string, max: number) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.slice(0, max) : "";
};

/**
 * Preview of an e-mail text for the sandboxed frame of the template editor. POST (form target = the frame),
 * so long drafts do not travel in a URL. The HTML is sanitized like a save; the response carries its own CSP
 * (no scripts, no connections, no embedding anywhere but this panel) and the frame is `sandbox`ed.
 */
export async function POST(request: Request) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const fd = await request.formData().catch(() => null);
  if (!fd) return new Response("Bad request", { status: 400 });
  const language = field(fd, "language", 2) === "en" ? "en" : "pl";
  const preview = previewEmailTemplate({
    slug: field(fd, "slug", 80),
    language,
    subject: field(fd, "subject", 300),
    html: field(fd, "html", 100_000),
    subjectEn: field(fd, "subjectEn", 300) || null,
    htmlEn: field(fd, "htmlEn", 100_000) || null,
  });
  return new Response(preview.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "x-preview-subject": encodeURIComponent(preview.subject),
    },
  });
}
