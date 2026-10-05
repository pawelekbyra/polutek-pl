import { describe, expect, it, beforeAll } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { getAccessConfig } from "@admin/lib/config";
import { verifyAccessRequest } from "@admin/lib/security/cf-access";

const TEAM = "https://pawelperfect.cloudflareaccess.com";
const AUD = "aud-tag-of-the-admin-app";
const config = { mode: "enforce" as const, teamDomain: TEAM, audience: AUD, allowedEmails: [] as string[] };

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey as CryptoKey;
  otherKey = (await generateKeyPair("RS256")).privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

async function token(opts: { aud?: string; iss?: string; exp?: string | number; email?: string; key?: CryptoKey } = {}) {
  return new SignJWT({ email: opts.email ?? "pawel.perfect@gmail.com", country: "PL" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? TEAM)
    .setAudience(opts.aud ?? AUD)
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? privateKey);
}

const headersWith = (t?: string) => new Headers(t ? { "cf-access-jwt-assertion": t } : {});

describe("Cloudflare Access JWT (layer 1)", () => {
  it("accepts a token signed by the team key for this application", async () => {
    const r = await verifyAccessRequest(headersWith(await token()), config, jwks);
    expect(r).toMatchObject({ ok: true, email: "pawel.perfect@gmail.com", subject: "user-1", country: "PL" });
  });

  it("refuses a request without the header", async () => {
    expect(await verifyAccessRequest(headersWith(), config, jwks)).toEqual({ ok: false, reason: "missing_token" });
  });

  it.each([
    ["another application (aud)", { aud: "some-other-app" }],
    ["another team (iss)", { iss: "https://evil.cloudflareaccess.com" }],
    ["an expired token", { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ["a foreign signing key", { key: undefined as unknown as CryptoKey, foreign: true }],
  ])("refuses %s", async (_name, opts) => {
    const t = "foreign" in opts ? await token({ key: otherKey }) : await token(opts as Parameters<typeof token>[0]);
    const r = await verifyAccessRequest(headersWith(t), config, jwks);
    expect(r).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("refuses garbage instead of a JWT", async () => {
    expect(await verifyAccessRequest(headersWith("not.a.jwt"), config, jwks)).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("enforces the optional e-mail allowlist", async () => {
    const strict = { ...config, allowedEmails: ["pawel.perfect@gmail.com"] };
    expect(await verifyAccessRequest(headersWith(await token()), strict, jwks)).toMatchObject({ ok: true });
    const r = await verifyAccessRequest(headersWith(await token({ email: "hello@pawelperfect.com" })), strict, jwks);
    expect(r).toMatchObject({ ok: false, reason: "email_not_allowed", email: "hello@pawelperfect.com" });
  });

  it("fails closed when Access is not configured", async () => {
    const r = await verifyAccessRequest(headersWith(await token()), { mode: "misconfigured", reason: "x" }, jwks);
    expect(r).toMatchObject({ ok: false, reason: "not_configured" });
  });
});

describe("getAccessConfig", () => {
  it("never allows the dev bypass in production", () => {
    expect(getAccessConfig({ NODE_ENV: "production", ADMIN_DEV_BYPASS_ACCESS: "1" })).toMatchObject({ mode: "misconfigured" });
  });

  it("allows the bypass only for local development", () => {
    expect(getAccessConfig({ NODE_ENV: "development", ADMIN_DEV_BYPASS_ACCESS: "1" })).toEqual({ mode: "dev-bypass" });
  });

  it("accepts only an https *.cloudflareaccess.com team domain", () => {
    expect(getAccessConfig({ NODE_ENV: "production", CF_ACCESS_TEAM_DOMAIN: "pawelperfect.cloudflareaccess.com", CF_ACCESS_AUD: AUD })).toEqual({
      mode: "enforce",
      teamDomain: TEAM,
      audience: AUD,
      allowedEmails: ["pawel.perfect@gmail.com"], // access mode (default): the owner is the explicit default
      requireEmail: true,
    });
    expect(getAccessConfig({ NODE_ENV: "production", ADMIN_AUTH_MODE: "passkey", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD })).toEqual({
      mode: "enforce",
      teamDomain: TEAM,
      audience: AUD,
      allowedEmails: [],
      requireEmail: false,
    });
    expect(getAccessConfig({ NODE_ENV: "production", CF_ACCESS_TEAM_DOMAIN: "https://evil.example.com", CF_ACCESS_AUD: AUD })).toMatchObject({ mode: "misconfigured" });
    expect(getAccessConfig({ NODE_ENV: "production", CF_ACCESS_TEAM_DOMAIN: TEAM })).toMatchObject({ mode: "misconfigured" });
  });

  it("normalises the e-mail allowlist", () => {
    const c = getAccessConfig({ NODE_ENV: "production", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, ADMIN_ACCESS_EMAILS: " Pawel.Perfect@gmail.com , " });
    expect(c).toMatchObject({ allowedEmails: ["pawel.perfect@gmail.com"] });
  });
});
