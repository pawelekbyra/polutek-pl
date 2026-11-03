/** Isolated Better Auth HTTP experiment. No production accounts, Prisma or application server.
 * Uses the installed library, its official memory adapter, and session constants read from Polutek.
 * Complete cookies, passwords, session IDs and tokens stay in memory and are never output.
 * Run from the repository root with Node 22. Waits ~62 real seconds to observe cache expiry.
 */
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { toNodeHandler } from 'better-auth/node';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const configPath = 'lib/auth/config.ts';
const configBytes = readFileSync(configPath);
const mod = { exports: {} };
new vm.Script(`(function(exports){${ts.transpileModule(configBytes.toString(), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText}\n})`, { filename: configPath }).runInThisContext()(mod.exports);
const c = mod.exports;
const sessionOptions = {
  expiresIn: c.SESSION_EXPIRES_IN_SECONDS,
  updateAge: c.SESSION_UPDATE_AGE_SECONDS,
  freshAge: c.SESSION_FRESH_AGE_SECONDS,
  cookieCache: { enabled: true, maxAge: c.SESSION_COOKIE_CACHE_SECONDS },
};
assert.equal(sessionOptions.cookieCache.maxAge, 60, 'Reassess this experiment when the application configuration changes');
const db = { user: [], session: [], account: [], verification: [] };
const password = randomBytes(24).toString('base64url');
let auth;
const server = createServer((req, res) => toNodeHandler(auth)(req, res));
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const baseURL = `http://127.0.0.1:${server.address().port}`;
auth = betterAuth({
  baseURL, secret: randomBytes(48).toString('base64url'), database: memoryAdapter(db),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: sessionOptions, rateLimit: { enabled: false }, telemetry: { enabled: false },
  advanced: { cookiePrefix: c.SESSION_COOKIE_PREFIX, useSecureCookies: false },
});

function applyCookies(jar, response) {
  for (const value of response.headers.getSetCookie()) {
    const first = value.split(';')[0];
    const i = first.indexOf('=');
    const name = first.slice(0, i);
    if (/max-age=0(?:;|$)/i.test(value)) jar.delete(name);
    else jar.set(name, first.slice(i + 1));
  }
}
async function request(path, jar, body) {
  const response = await fetch(`${baseURL}/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: baseURL, ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { response, data };
}
async function check(path, jar) {
  const { response, data } = await request(path, jar);
  return { status: response.status, authenticated: Boolean(data?.user?.id) };
}
async function login() {
  const jar = new Map();
  const { response } = await request('/sign-in/email', jar, { email: 'audit@example.invalid', password });
  assert.equal(response.status, 200, 'Fixture sign-in failed');
  applyCookies(jar, response);
  assert.equal((await check('/get-session', jar)).authenticated, true, 'No valid session before revocation');
  return jar;
}

try {
  const signup = await request('/sign-up/email', new Map(), { name: 'Audit fixture', email: 'audit@example.invalid', password });
  assert.equal(signup.response.status, 200, 'Fixture sign-up failed');
  // Discard the sign-up session before testing; the fixture setup is not the subject of this experiment.
  db.session.splice(0);
  const original = await login();
  const replay = new Map(original);
  const before = await check('/get-session', replay);
  const logout = await request('/sign-out', original, {});
  assert.equal(logout.response.status, 200);
  applyCookies(original, logout.response);
  const sessionRowsAfterLogout = db.session.length;
  const loggedOutBrowser = await check('/get-session', original);
  const replayAfterLogout = await check('/get-session', replay);
  const freshAfterLogout = await check('/get-session?disableCookieCache=true', replay);
  const tokenOnly = new Map([...replay].filter(([name]) => name.endsWith('.session_token')));
  const tokenOnlyAfterLogout = await check('/get-session', tokenOnly);
  assert.equal(sessionRowsAfterLogout, 0);
  assert.equal(loggedOutBrowser.authenticated, false);
  assert.equal(replayAfterLogout.authenticated, true);
  assert.equal(freshAfterLogout.authenticated, false);
  assert.equal(tokenOnlyAfterLogout.authenticated, false);
  const logoutObservedAt = Date.now();

  const revokedDevice = await login();
  const revoker = await login();
  const revokeOthers = await request('/revoke-other-sessions', revoker, {});
  assert.equal(revokeOthers.response.status, 200);
  const sessionRowsAfterRevokeOthers = db.session.length;
  const replayAfterRevokeOthers = await check('/get-session', revokedDevice);
  const freshAfterRevokeOthers = await check('/get-session?disableCookieCache=true', revokedDevice);
  const revokerStillAuthenticated = await check('/get-session?disableCookieCache=true', revoker);
  assert.equal(sessionRowsAfterRevokeOthers, 1);
  assert.equal(replayAfterRevokeOthers.authenticated, true);
  assert.equal(freshAfterRevokeOthers.authenticated, false);
  assert.equal(revokerStillAuthenticated.authenticated, true);
  const otherRevocationObservedAt = Date.now();
  process.stderr.write('Initial logout and other-session revocation observations complete; waiting for real 60-second cache expiry. No cookie/token output.\n');
  await new Promise(resolve => setTimeout(resolve, (c.SESSION_COOKIE_CACHE_SECONDS + 2) * 1000));
  const replayAfterExpiry = await check('/get-session', replay);
  const otherReplayAfterExpiry = await check('/get-session', revokedDevice);
  assert.equal(replayAfterExpiry.authenticated, false);
  assert.equal(otherReplayAfterExpiry.authenticated, false);
  const result = {
    kind: 'ISOLATED_REAL_BETTER_AUTH_HTTP_WITH_OFFICIAL_MEMORY_ADAPTER',
    application_baseline_sha: 'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
    dependency_version: JSON.parse(readFileSync('node_modules/better-auth/package.json')).version,
    config_source: configPath,
    config_sha256: createHash('sha256').update(configBytes).digest('hex'), sessionOptions,
    differences_from_application: ['Official memory adapter instead of Prisma/PostgreSQL',
      'No application hooks/plugins, DB-backed role/status resolver, Next middleware or Next routes',
      'Fixture registration without email verification; random test password/secret; rate limiting disabled',
      'Loopback HTTP with non-Secure cookies; no Cloudflare/OAuth/production traffic'],
    cookie_names_only: [...replay.keys()].sort(),
    observations: { before, sessionRowsAfterLogout, loggedOutBrowser, replayAfterLogout,
      freshAfterLogout, tokenOnlyAfterLogout, sessionRowsAfterRevokeOthers, replayAfterRevokeOthers,
      freshAfterRevokeOthers, revokerStillAuthenticated, replayAfterExpiry, otherReplayAfterExpiry },
    real_elapsed_since_logout_observation_ms: Date.now() - logoutObservedAt,
    real_elapsed_since_other_revocation_observation_ms: Date.now() - otherRevocationObservedAt,
    interpretation: 'Revoked session cookies including a valid cache still authenticate at the library endpoint before TTL; force-fresh reads and token-only replay refuse. Not a full Polutek HTTP or production test.',
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
