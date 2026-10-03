/**
 * PP Support: warstwa marki przed panelem (support.pawelperfect.com).
 * Wstrzykuje CSS/JS i ikony do stron HTML panelu oraz serwuje wlasne zasoby pod /pp-support/*.
 * Wszystko inne (API, websockety, ingress poczty, zasoby statyczne) idzie 1:1 do origin.
 * Kill switch: binding BRAND_ENABLED=0 (node workers/support-brand/deploy.mjs --disable) = czysty pass-through.
 * Dane (zasoby, nazwa) sa doklejane przez deploy.mjs w miejsce znacznika danych nizej.
 */
const DATA = __DATA__;
const SKIP = /^\/(api|auth|cable|rails|webhooks|vite|packs|assets|audio|videos|pp-support)(\/|$)/;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function serveAsset(path, method) {
  const a = DATA.assets[path];
  if (!a || (method !== 'GET' && method !== 'HEAD')) return new Response('Not found', { status: 404 });
  const body = method === 'HEAD' ? null : a.text !== undefined ? a.text : b64ToBytes(a.b64);
  return new Response(body, { headers: { 'content-type': a.type, 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
}

function headHtml() {
  const v = DATA.version;
  const b = DATA.brand;
  return [
    `<script>window.PP_BRAND=${JSON.stringify({ name: b.name, shortName: b.shortName, termsUrl: b.termsUrl, privacyUrl: b.privacyUrl })};</script>`,
    `<link rel="icon" type="image/svg+xml" href="/pp-support/logo-thumbnail.svg?v=${v}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/pp-support/icon-32.png?v=${v}">`,
    `<link rel="icon" type="image/png" sizes="96x96" href="/pp-support/icon-96.png?v=${v}">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/pp-support/icon-180.png?v=${v}">`,
    `<link rel="manifest" href="/pp-support/manifest.webmanifest?v=${v}" crossorigin="use-credentials">`,
    `<meta name="theme-color" content="${b.accent}">`,
    `<link rel="stylesheet" href="/pp-support/brand.css?v=${v}">`,
    `<script src="/pp-support/brand.js?v=${v}" defer></script>`,
  ].join('');
}

export default {
  async fetch(request, env) {
    if (env.BRAND_ENABLED === '0') return fetch(request);
    const url = new URL(request.url);
    if (url.pathname.startsWith('/pp-support/')) return serveAsset(url.pathname, request.method);
    const accept = request.headers.get('accept') || '';
    if (request.method !== 'GET' || SKIP.test(url.pathname) || !accept.includes('text/html')) return fetch(request);

    const res = await fetch(request);
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const rewritten = new HTMLRewriter()
      .on('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], meta[name="msapplication-TileImage"], meta[name="theme-color"], meta[name="msapplication-TileColor"]', { element: (e) => e.remove() })
      .on('meta[name="description"]', { element: (e) => e.setAttribute('content', `${DATA.brand.name}: wspolna skrzynka obslugi klienta.`) })
      .on('head', { element: (e) => e.append(headHtml(), { html: true }) })
      .transform(res);
    const out = new Response(rewritten.body, rewritten);
    out.headers.set('x-pp-brand', DATA.version);
    return out;
  },
};
