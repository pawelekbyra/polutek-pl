/**
 * Cloudflare Worker: token-checked, edge-cached delivery of our own HLS from a
 * private R2 bucket (binding HLS). Deployed on the Free plan, see
 * docs/architecture/self-hosted-hls.md and docs/operations/HLS-SELF-HOSTED.md.
 *
 * URL:  https://video.pawelperfect.com/h/<exp>.<sig>/<videoId>/<version>/<file>
 *   exp  unix seconds (token expiry)
 *   sig  base64url(HMAC-SHA256(HLS_TOKEN_SECRET, "<videoId>/<version>/<exp>"))
 * A PUBLIC video's token is "<exp>.<sig>.pub" with sig over "<videoId>/<version>/<exp>/pub".
 * Tokens without ".pub" (protected videos, and every token issued before ".pub" existed) get
 * PRIVATE response headers bounded by the token's remaining life; only ".pub" tokens get the
 * long public cache (audit S09). Deploy this Worker BEFORE the app starts issuing ".pub" tokens.
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
/** Longest a client may reuse a playlist of a protected video without asking again. */
const PROTECTED_PLAYLIST_MAX_AGE = 60;

const enc = new TextEncoder();

function base64urlDecode(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Message that is signed for a video version; must match lib/modules/playback self-hls-token.service. */
export function tokenMessage(videoId, version, exp, isPublic = false) {
  return `${videoId}/${version}/${exp}${isPublic ? '/pub' : ''}`;
}

const TOKEN_RE = /^(\d{10})\.([A-Za-z0-9_-]{43})(\.pub)?$/;

/** Verifies "<exp>.<sig>[.pub]". Returns { exp, isPublic } or null. Constant-time compare through WebCrypto. */
export async function checkToken(secret, videoId, version, token, nowSeconds) {
  if (!secret || typeof token !== 'string') return null;
  const m = TOKEN_RE.exec(token);
  if (!m) return null;
  const exp = Number(m[1]);
  if (exp <= nowSeconds) return null;
  const isPublic = m[3] === '.pub';
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, base64urlDecode(m[2]), enc.encode(tokenMessage(videoId, version, exp, isPublic)));
  return ok ? { exp, isPublic } : null;
}

/** Boolean form of checkToken. */
export async function verifyToken(secret, videoId, version, token, nowSeconds) {
  return (await checkToken(secret, videoId, version, token, nowSeconds)) !== null;
}

/**
 * Cache-Control sent to the CLIENT (the copy kept in the Worker's own cache is always the long
 * public one, see objectHeaders: that cache sits behind the token check). Public video: long and
 * public. Protected: private (no shared cache may keep it) and never longer than the token's
 * remaining life, so a browser copy does not outlive the access the token stood for.
 */
export function clientCacheControl(ext, token, nowSeconds) {
  if (token.isPublic) return ext === 'm3u8' ? SHORT : IMMUTABLE;
  const remaining = Math.max(0, token.exp - nowSeconds);
  const maxAge = ext === 'm3u8' ? Math.min(remaining, PROTECTED_PLAYLIST_MAX_AGE) : remaining;
  return `private, max-age=${maxAge}`;
}

/** The imported HMAC key, kept for the life of the isolate (re-imported only if the secret changes). */
let cachedKey = null;
function hmacKey(secret) {
  if (cachedKey?.secret !== secret) {
    cachedKey = { secret, key: crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']) };
  }
  return cachedKey.key;
}

/** "bytes start-end/size" for an R2 object read with a range. */
export function contentRange(range, size) {
  const offset = 'suffix' in range ? Math.max(0, size - range.suffix) : (range.offset ?? 0);
  const length = 'suffix' in range ? size - offset : (range.length ?? size - offset);
  return { offset, length, header: `bytes ${offset}-${offset + length - 1}/${size}` };
}

/** Headers of the copy stored in the Worker's own edge cache (never sent as is to a protected client). */
function objectHeaders(parsed, object) {
  const headers = new Headers();
  headers.set('Content-Type', CONTENT_TYPES[parsed.ext]);
  headers.set('Cache-Control', parsed.ext === 'm3u8' ? SHORT : IMMUTABLE);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
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
    const token = await checkToken(env.HLS_TOKEN_SECRET, parsed.videoId, parsed.version, parsed.token, nowSeconds);
    if (!token) return plain(403, 'Forbidden', request, env);

    const cacheUrl = `https://${url.host}/c/${parsed.videoId}/${parsed.version}/${parsed.rest}`;
    const cache = caches.default;
    const range = request.headers.get('Range');
    const lookup = new Request(cacheUrl, { method: 'GET', headers: range ? { Range: range } : {} });

    let response = await cache.match(lookup);
    let cacheStatus = 'HIT';
    if (!response) {
      cacheStatus = 'MISS';
      const objectKey = `videos/${parsed.videoId}/v/${parsed.version}/${parsed.rest}`;
      const fillCache = async () => {
        const object = await env.HLS.get(objectKey);
        if (object) await cache.put(new Request(cacheUrl, { method: 'GET' }), new Response(object.body, { status: 200, headers: objectHeaders(parsed, object) }));
      };
      if (method === 'HEAD') {
        // Metadata only: no body read from R2 and nothing cached.
        const object = await env.HLS.head(objectKey);
        if (!object) return plain(404, 'Not found', request, env);
        const headers = objectHeaders(parsed, object);
        headers.set('Content-Length', String(object.size));
        response = new Response(null, { status: 200, headers });
      } else if (range) {
        // Answer the range straight from R2 (no waiting for the whole object) and fill the
        // cache with the complete object in the background; the cache only stores full bodies.
        let object;
        try {
          object = await env.HLS.get(objectKey, { range: request.headers });
        } catch {
          return plain(416, 'Range not satisfiable', request, env);
        }
        if (!object) return plain(404, 'Not found', request, env);
        const headers = objectHeaders(parsed, object);
        if (object.range) {
          const r = contentRange(object.range, object.size);
          headers.set('Content-Range', r.header);
          headers.set('Content-Length', String(r.length));
          response = new Response(object.body, { status: 206, headers });
        } else {
          response = new Response(object.body, { status: 200, headers });
        }
        ctx.waitUntil(fillCache());
      } else {
        const object = await env.HLS.get(objectKey);
        if (!object) return plain(404, 'Not found', request, env);
        const full = new Response(object.body, { status: 200, headers: objectHeaders(parsed, object) });
        ctx.waitUntil(cache.put(new Request(cacheUrl, { method: 'GET' }), full.clone()));
        response = full;
      }
    }

    const out = new Response(method === 'HEAD' ? null : response.body, response);
    for (const [k, v] of corsHeaders(request, env)) out.headers.set(k, v);
    out.headers.set('X-Hls-Cache', cacheStatus);
    out.headers.set('Cache-Control', clientCacheControl(parsed.ext, token, nowSeconds));
    return out;
  },
};
