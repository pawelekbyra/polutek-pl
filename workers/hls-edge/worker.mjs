/**
 * Cloudflare Worker: token-checked, edge-cached delivery of our own HLS from a
 * private R2 bucket (binding HLS). Deployed on the Free plan, see
 * docs/architecture/self-hosted-hls.md and docs/operations/HLS-SELF-HOSTED.md.
 *
 * URL:  https://video.pawelperfect.com/h/<exp>.<sig>/<videoId>/<version>/<file>
 *   exp  unix seconds (token expiry)
 *   sig  base64url(HMAC-SHA256(HLS_TOKEN_SECRET, "<videoId>/<version>/<exp>"))
 *
 * One token covers every file of one video version (playlists, init, segments,
 * poster), so the playlists only need RELATIVE URIs and both hls.js and native
 * Safari HLS simply inherit "/h/<exp>.<sig>/<videoId>/<version>/" - no headers,
 * cookies or manifest rewriting. The token is issued by PlaybackService only
 * after checkVideoAccess() + the premiere gate (CLAUDE.md 4.3, 4.15).
 *
 * Cache: the edge cache key is the token-less path, so one cached copy serves
 * every viewer; the token is verified on EVERY request before the cache is
 * consulted. This is access control, not DRM: a signed-in viewer can copy the
 * URL for the token lifetime.
 *
 * No dependencies, plain ES module (uploaded as-is, no build step).
 */

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const VERSION_RE = /^[A-Za-z0-9_-]{1,32}$/;
const REST_RE = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]{2,5}$/;

const CONTENT_TYPES = {
  m3u8: 'application/vnd.apple.mpegurl',
  m4s: 'video/iso.segment',
  mp4: 'video/mp4',
  ts: 'video/mp2t',
  vtt: 'text/vtt; charset=utf-8',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=300';

const enc = new TextEncoder();

function base64urlDecode(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Message that is signed for a video version; must match lib/modules/playback self-hls-token.service. */
export function tokenMessage(videoId, version, exp) {
  return `${videoId}/${version}/${exp}`;
}

/** Verifies "<exp>.<sig>". Constant-time compare through WebCrypto. */
export async function verifyToken(secret, videoId, version, token, nowSeconds) {
  if (!secret || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expText = token.slice(0, dot);
  const sigText = token.slice(dot + 1);
  if (!/^\d{10}$/.test(expText) || !/^[A-Za-z0-9_-]{43}$/.test(sigText)) return false;
  const exp = Number(expText);
  if (exp <= nowSeconds) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, base64urlDecode(sigText), enc.encode(tokenMessage(videoId, version, exp)));
}

/** Splits "/h/<token>/<id>/<version>/<rest>" or returns null. */
export function parsePath(pathname) {
  const parts = pathname.split('/');
  // ['', 'h', token, id, version, ...rest]
  if (parts.length < 6 || parts[0] !== '' || parts[1] !== 'h') return null;
  const [, , token, videoId, version, ...restParts] = parts;
  const rest = restParts.join('/');
  if (!ID_RE.test(videoId) || !VERSION_RE.test(version) || !REST_RE.test(rest)) return null;
  const ext = rest.slice(rest.lastIndexOf('.') + 1).toLowerCase();
  if (!CONTENT_TYPES[ext]) return null;
  return { token, videoId, version, rest, ext };
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const headers = new Headers({ Vary: 'Origin' });
  if (origin && allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    headers.set('Timing-Allow-Origin', origin);
  }
  return headers;
}

function plain(status, body, request, env) {
  const headers = corsHeaders(request, env);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(body, { status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const method = request.method;
    if (method === 'OPTIONS') {
      const headers = corsHeaders(request, env);
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Range');
      headers.set('Access-Control-Max-Age', '86400');
      return new Response(null, { status: 204, headers });
    }
    if (method !== 'GET' && method !== 'HEAD') return plain(405, 'Method not allowed', request, env);

    const url = new URL(request.url);
    const parsed = parsePath(url.pathname);
    if (!parsed) return plain(404, 'Not found', request, env);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ok = await verifyToken(env.HLS_TOKEN_SECRET, parsed.videoId, parsed.version, parsed.token, nowSeconds);
    if (!ok) return plain(403, 'Forbidden', request, env);

    const cacheUrl = `https://${url.host}/c/${parsed.videoId}/${parsed.version}/${parsed.rest}`;
    const cache = caches.default;
    const range = request.headers.get('Range');
    const lookup = new Request(cacheUrl, { method: 'GET', headers: range ? { Range: range } : {} });

    let response = await cache.match(lookup);
    let cacheStatus = 'HIT';
    if (!response) {
      cacheStatus = 'MISS';
      const object = await env.HLS.get(`videos/${parsed.videoId}/v/${parsed.version}/${parsed.rest}`);
      if (!object) return plain(404, 'Not found', request, env);
      const headers = new Headers();
      headers.set('Content-Type', CONTENT_TYPES[parsed.ext]);
      headers.set('Cache-Control', parsed.ext === 'm3u8' ? SHORT : IMMUTABLE);
      headers.set('ETag', object.httpEtag);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('X-Content-Type-Options', 'nosniff');
      const full = new Response(object.body, { status: 200, headers });
      if (range) {
        // The cache can only store complete responses; store it, then let the
        // cache answer the Range request.
        await cache.put(new Request(cacheUrl, { method: 'GET' }), full);
        response = (await cache.match(lookup)) ?? new Response('Range failed', { status: 500 });
      } else {
        ctx.waitUntil(cache.put(new Request(cacheUrl, { method: 'GET' }), full.clone()));
        response = full;
      }
    }

    const out = new Response(method === 'HEAD' ? null : response.body, response);
    for (const [k, v] of corsHeaders(request, env)) out.headers.set(k, v);
    out.headers.set('X-Hls-Cache', cacheStatus);
    out.headers.set('Cache-Control', parsed.ext === 'm3u8' ? SHORT : IMMUTABLE);
    return out;
  },
};
