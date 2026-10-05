/**
 * ADMIN_AUTH_MODE=access: the verified Cloudflare Access JWT is the sign-in.
 * Keys are generated here (no real secrets); the database is faked in memory.
 */
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type UserRow = { id: string; email: string; name: string; role: string };
const db = vi.hoisted(() => ({ users: new Map<string, { id: string; email: string; name: string; role: string }>(), events: [] as Record<string, unknown>[], createCalls: 0, raceOnce: false }));
const audit = vi.hoisted(() => ({ recordAdminAuthEvent: vi.fn(async (e: Record<string, unknown>) => void db.events.push(e)) }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => db.users.get(where.email) ?? null),
      create: vi.fn(async ({ data }: { data: UserRow }) => {
        db.createCalls++;
        if (db.raceOnce) {
          db.raceOnce = false;
          db.users.set(data.email, { ...data, id: "winner" });
          throw new Error("P2002 unique");
        }
        if (db.users.has(data.email)) throw new Error("P2002 unique");
        db.users.set(data.email, data);
        return data;
      }),
    },
    adminAuthEvent: {
      findFirst: vi.fn(async ({ where }: { where: { reason: string } }) => db.events.find((e) => e.action === "ADMIN_ACCESS_SIGN_IN" && e.reason === where.reason) ?? null),
    },
  },
}));
vi.mock("@admin/lib/auth/audit", () => audit);

import { ADMIN_ACCESS_MAX_AGE_SECONDS, getAccessConfig, getAdminAuthMode, isDevAuthBypassEnabled, parseAdminAuthMode, stepUpMessage } from "@admin/lib/config";
import { accessSecondsLeft, isAccessTokenFresh, resetAccessSessionMemory, resolveAccessSession } from "@admin/lib/auth/access-session";
import { verifyAccessRequest } from "@admin/lib/security/cf-access";

const TEAM = "https://pawelperfect.cloudflareaccess.com";
const AUD = "aud-tag-of-the-admin-app";
const OWNER = "pawel.perfect@gmail.com";
const ENV = { NODE_ENV: "production", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD } as Record<string, string>;

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey as CryptoKey;
  otherKey = (await generateKeyPair("RS256")).privateKey as CryptoKey;
  jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" }] });
});

beforeEach(() => {
  db.users.clear();
  db.events.length = 0;
  db.createCalls = 0;
  db.raceOnce = false;
  audit.recordAdminAuthEvent.mockClear();
  resetAccessSessionMemory();
});

type TokenOpts = { email?: string | null; aud?: string; iss?: string; exp?: string | number; iat?: number; key?: CryptoKey };
async function token(o: TokenOpts = {}) {
  const claims: Record<string, unknown> = {};
  if (o.email !== null) claims.email = o.email ?? OWNER;
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(o.iss ?? TEAM)
    .setAudience(o.aud ?? AUD)
    .setSubject("sub-1")
    .setIssuedAt(o.iat ?? Math.floor(Date.now() / 1000))
    .setExpirationTime(o.exp ?? "5m");
  return jwt.sign(o.key ?? privateKey);
}
const hdr = (t?: string, extra: Record<string, string> = {}) => new Headers({ ...(t ? { "cf-access-jwt-assertion": t } : {}), ...extra });
const resolve = (headers: Headers, env: Record<string, string> = ENV) => resolveAccessSession(headers, { env, getKey: jwks });

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("ADMIN_AUTH_MODE", () => {
  it("defaults to access, accepts passkey, and never maps a typo to the weaker mode", () => {
    expect(getAdminAuthMode({})).toBe("access");
    expect(getAdminAuthMode({ ADMIN_AUTH_MODE: " Access " })).toBe("access");
    expect(getAdminAuthMode({ ADMIN_AUTH_MODE: "passkey" })).toBe("passkey");
    expect(parseAdminAuthMode({ ADMIN_AUTH_MODE: "pass-key" })).toEqual({ ok: false, value: "pass-key" });
    expect(getAdminAuthMode({ ADMIN_AUTH_MODE: "pass-key" })).toBe("passkey");
    expect(getAccessConfig({ ...ENV, ADMIN_AUTH_MODE: "pass-key" })).toMatchObject({ mode: "misconfigured" });
  });

  it("defaults the allowed e-mails to the owner in access mode, keeps the legacy list empty-means-any", () => {
    expect(getAccessConfig(ENV)).toMatchObject({ mode: "enforce", allowedEmails: [OWNER], requireEmail: true });
    expect(getAccessConfig({ ...ENV, ADMIN_ACCESS_EMAILS: "A@x.test, b@x.test" })).toMatchObject({ allowedEmails: ["a@x.test", "b@x.test"] });
    expect(getAccessConfig({ ...ENV, ADMIN_AUTH_MODE: "passkey" })).toMatchObject({ allowedEmails: [], requireEmail: false });
    expect(getAccessConfig({ ...ENV, ADMIN_OWNER_EMAIL: "Boss@x.test" })).toMatchObject({ allowedEmails: ["boss@x.test"] });
  });

  it("words the step-up refusal for the mode", () => {
    expect(stepUpMessage("legacy text", {})).toContain("Cloudflare Access");
    expect(stepUpMessage("legacy text", { ADMIN_AUTH_MODE: "passkey" })).toBe("legacy text");
  });
});

describe("Access JWT as the login (verification)", () => {
  const cfg = getAccessConfig(ENV);
  if (cfg.mode !== "enforce") throw new Error("test config");

  it("accepts a valid token and returns the e-mail of the SIGNED payload", async () => {
    const r = await verifyAccessRequest(hdr(await token()), cfg, jwks);
    expect(r).toMatchObject({ ok: true, email: OWNER, subject: "sub-1" });
    expect(r.ok && typeof r.issuedAt).toBe("number");
    expect(r.ok && typeof r.expiresAt).toBe("number");
  });

  it.each([
    ["wrong audience", { aud: "another-app" }],
    ["wrong issuer", { iss: "https://evil.cloudflareaccess.com" }],
    ["expired", { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ["bad signature (foreign key)", { key: "foreign" }],
  ])("refuses a token with %s", async (_n, o) => {
    const t = "key" in o ? await token({ key: otherKey }) : await token(o as TokenOpts);
    expect(await verifyAccessRequest(hdr(t), cfg, jwks)).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("refuses alg none and an HS256 token signed with the public key text", async () => {
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ email: OWNER, iss: TEAM, aud: AUD, exp: Math.floor(Date.now() / 1000) + 300 })}.`;
    expect(await verifyAccessRequest(hdr(none), cfg, jwks)).toMatchObject({ ok: false, reason: "invalid_token" });
    const hs = await new SignJWT({ email: OWNER }).setProtectedHeader({ alg: "HS256", kid: "k1" }).setIssuer(TEAM).setAudience(AUD).setExpirationTime("5m").sign(new TextEncoder().encode("x".repeat(40)));
    expect(await verifyAccessRequest(hdr(hs), cfg, jwks)).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("refuses a valid token without an e-mail claim (service token) in access mode", async () => {
    expect(await verifyAccessRequest(hdr(await token({ email: null })), cfg, jwks)).toMatchObject({ ok: false, reason: "missing_email" });
  });

  it("refuses an e-mail that is not allowed", async () => {
    expect(await verifyAccessRequest(hdr(await token({ email: "intruder@example.test" })), cfg, jwks)).toMatchObject({ ok: false, reason: "email_not_allowed", email: "intruder@example.test" });
  });

  it("ignores unsigned e-mail headers: the owner header cannot upgrade another identity", async () => {
    const forged = hdr(await token({ email: "intruder@example.test" }), { "cf-access-authenticated-user-email": OWNER, "x-panel-access-email": OWNER, "x-forwarded-email": OWNER });
    expect(await verifyAccessRequest(forged, cfg, jwks)).toMatchObject({ ok: false, reason: "email_not_allowed" });
    // and with no token at all the headers alone are worth nothing
    expect(await verifyAccessRequest(hdr(undefined, { "cf-access-authenticated-user-email": OWNER }), cfg, jwks)).toMatchObject({ ok: false, reason: "missing_token" });
  });
});

describe("mapping the Access identity to a panel account", () => {
  it("creates the owner on first login (role OWNER) and is idempotent afterwards", async () => {
    const h = hdr(await token());
    const first = await resolve(h);
    expect(first).toMatchObject({ ok: true, session: { user: { email: OWNER, role: "OWNER" } } });
    const second = await resolve(hdr(await token()));
    expect(second.ok && second.session.user.id).toBe(first.ok && first.session.user.id);
    expect(db.createCalls).toBe(1);
    expect(db.users.size).toBe(1);
  });

  it("survives a creation race (the loser reads the winner's row)", async () => {
    db.raceOnce = true;
    const r = await resolve(hdr(await token()));
    expect(r).toMatchObject({ ok: true, session: { user: { id: "winner" } } });
  });

  it("matches a translator by e-mail, keeping the role, only when Access allows that e-mail", async () => {
    db.users.set("tl@example.test", { id: "t1", email: "tl@example.test", name: "T", role: "TRANSLATOR" });
    const env = { ...ENV, ADMIN_ACCESS_EMAILS: `${OWNER},tl@example.test` };
    expect(await resolve(hdr(await token({ email: "TL@example.test" })), env)).toMatchObject({ ok: true, session: { user: { id: "t1", role: "TRANSLATOR" } } });
    // not in the Access list -> refused although the account exists
    expect(await resolve(hdr(await token({ email: "tl@example.test" })))).toMatchObject({ ok: false, reason: "access_denied" });
    expect(db.createCalls).toBe(0);
  });

  it("never creates an account for an allowed e-mail that is not the owner", async () => {
    const env = { ...ENV, ADMIN_ACCESS_EMAILS: `${OWNER},new@example.test` };
    expect(await resolve(hdr(await token({ email: "new@example.test" })), env)).toMatchObject({ ok: false, reason: "no_account", email: "new@example.test" });
    expect(db.users.size).toBe(0);
    expect(db.events.some((e) => e.action === "ADMIN_ACCESS_DENIED")).toBe(true);
  });

  it("keeps an existing legacy OWNER account (enrolled with passkeys) as the same user", async () => {
    db.users.set(OWNER, { id: "legacy-owner", email: OWNER, name: "Paweł", role: "OWNER" });
    expect(await resolve(hdr(await token()))).toMatchObject({ ok: true, session: { user: { id: "legacy-owner", name: "Paweł" } } });
  });

  it("treats an unknown stored role as the least privileged one", async () => {
    db.users.set(OWNER, { id: "x", email: OWNER, name: "X", role: "SUPERUSER" });
    expect(await resolve(hdr(await token()))).toMatchObject({ ok: true, session: { user: { role: "TRANSLATOR" } } });
  });

  it("answers not_configured without Access settings in production (503 at the proxy)", async () => {
    expect(await resolve(hdr(await token()), { NODE_ENV: "production" })).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("audit of Access sign-ins", () => {
  it("writes ONE ADMIN_ACCESS_SIGN_IN per new token, not per request, and again for a new token", async () => {
    const t1 = await token();
    await resolve(hdr(t1));
    await resolve(hdr(t1));
    await resolve(hdr(t1));
    expect(db.events.filter((e) => e.action === "ADMIN_ACCESS_SIGN_IN")).toHaveLength(1);
    const t2 = await token({ iat: Math.floor(Date.now() / 1000) + 1 });
    await resolve(hdr(t2));
    expect(db.events.filter((e) => e.action === "ADMIN_ACCESS_SIGN_IN")).toHaveLength(2);
    expect(db.events[0]).toMatchObject({ outcome: "success", email: OWNER });
    expect(JSON.stringify(db.events)).not.toContain(t1);
  });

  it("does not duplicate after a restart (the fingerprint is found in the log)", async () => {
    const t = await token();
    await resolve(hdr(t));
    resetAccessSessionMemory();
    await resolve(hdr(t));
    expect(db.events.filter((e) => e.action === "ADMIN_ACCESS_SIGN_IN")).toHaveLength(1);
  });

  it("logs a refused (validly signed) identity once per token", async () => {
    const t = await token({ email: "intruder@example.test" });
    await resolve(hdr(t));
    await resolve(hdr(t));
    expect(db.events.filter((e) => e.action === "ADMIN_ACCESS_DENIED")).toHaveLength(1);
  });

  it("logs nothing for garbage tokens (cannot flood the chain)", async () => {
    await resolve(hdr("a.b.c"));
    await resolve(hdr(await token({ key: otherKey })));
    expect(db.events).toHaveLength(0);
  });
});

describe("freshness for sensitive actions", () => {
  const now = Date.now();
  it("is fresh inside 12 h and stale beyond (a stretched Access session)", () => {
    expect(isAccessTokenFresh({ issuedAt: Math.floor(now / 1000) - 60, dev: false }, now)).toBe(true);
    expect(isAccessTokenFresh({ issuedAt: Math.floor(now / 1000) - ADMIN_ACCESS_MAX_AGE_SECONDS - 5, dev: false }, now)).toBe(false);
    expect(isAccessTokenFresh({ issuedAt: null, dev: false }, now)).toBe(false);
    expect(accessSecondsLeft({ issuedAt: Math.floor(now / 1000) - ADMIN_ACCESS_MAX_AGE_SECONDS + 600, dev: false }, now)).toBeGreaterThan(590);
    expect(accessSecondsLeft({ issuedAt: Math.floor(now / 1000) - ADMIN_ACCESS_MAX_AGE_SECONDS - 5, dev: false }, now)).toBe(0);
  });
});

describe("local development bypass", () => {
  it("is refused in production, whatever the flags", async () => {
    const prod = { ...ENV, ADMIN_DEV_BYPASS_ACCESS: "1", ADMIN_DEV_BYPASS_AUTH: "1", ADMIN_DEV_EMAIL: "x@x.test" };
    expect(getAccessConfig(prod)).toMatchObject({ mode: "enforce" });
    expect(isDevAuthBypassEnabled(prod)).toBe(false);
    expect(await resolve(hdr(), prod)).toMatchObject({ ok: false, reason: "access_denied" });
    expect(await resolve(hdr(), { NODE_ENV: "production", ADMIN_DEV_BYPASS_ACCESS: "1" })).toEqual({ ok: false, reason: "not_configured" });
    expect(db.users.size).toBe(0);
  });

  it("acts as the owner only outside production with the explicit flag", async () => {
    const dev = { NODE_ENV: "development", ADMIN_DEV_BYPASS_ACCESS: "1" };
    expect(await resolve(hdr(), dev)).toMatchObject({ ok: true, session: { dev: true, user: { email: OWNER, role: "OWNER" } } });
    expect(await resolve(hdr(), { NODE_ENV: "development" })).toEqual({ ok: false, reason: "not_configured" });
    expect(isDevAuthBypassEnabled({ NODE_ENV: "development", ADMIN_DEV_BYPASS_AUTH: "1" })).toBe(true);
    expect(isDevAuthBypassEnabled({ NODE_ENV: "development" })).toBe(false);
  });
});
