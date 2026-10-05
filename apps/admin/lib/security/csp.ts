/**
 * Content Security Policy of the panel: strict, nonce based, no external origins at all.
 * Next.js reads the nonce from the request's CSP header and puts it on its own scripts
 * (https://nextjs.org/docs/app/guides/content-security-policy). There are no inline `style`
 * attributes in the panel markup (meters and charts are SVG with presentation attributes), so
 * `style-src` needs no 'unsafe-inline' in production either.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Presigned multipart uploads go to `<account>.r2.cloudflarestorage.com` (path-style bucket URLs). */
export const R2_UPLOAD_ORIGIN = "https://*.r2.cloudflarestorage.com";

export function buildCsp(nonce: string, opts: { dev?: boolean } = {}): string {
  const dev = !!opts.dev;
  const directives: Record<string, string> = {
    "default-src": "'self'",
    // 'strict-dynamic': scripts loaded by a nonce'd script are trusted; 'self' and hosts are ignored by
    // CSP3 browsers and only matter as a fallback. 'unsafe-eval' only for React's dev tooling.
    "script-src": `'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Next's dev server injects style tags without a nonce; production uses only linked CSS + nonce.
    "style-src": dev ? "'self' 'unsafe-inline'" : `'self' 'nonce-${nonce}'`,
    "img-src": "'self' data:",
    "font-src": "'self'",
    // R2 S3 endpoint: the browser PUTs parts of the original film straight to presigned URLs (phase 2).
    "connect-src": `'self' ${R2_UPLOAD_ORIGIN}${dev ? " ws:" : ""}`,
    "media-src": "'none'",
    "object-src": "'none'",
    // Only the e-mail preview (/api/email/preview, a sandboxed frame with its own strict CSP) is ever framed.
    "frame-src": "'self'",
    "worker-src": "'self'",
    "manifest-src": "'self'",
    "base-uri": "'none'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
