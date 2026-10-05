/**
 * Access-mode sign-in on a real Postgres: owner auto-provision (idempotent, concurrent), translator matching,
 * one ADMIN_ACCESS_SIGN_IN per token and an intact AdminAuthEvent hash chain.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts tests/postgres/admin-access-login.pg.test.ts
 */
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetAccessSessionMemory, resolveAccessSession } from '../../apps/admin/lib/auth/access-session';
import { canonicalEventString, chainHash } from '../../apps/admin/lib/auth/audit';

const prisma = new PrismaClient();
const RUN = `pg-acc-${Date.now().toString(36)}`;
const owner = `${RUN}-owner@example.test`;
const translator = `${RUN}-tr@example.test`;
const TEAM = 'https://pawelperfect.cloudflareaccess.com';
const AUD = 'aud-pg';
const env = { NODE_ENV: 'production', CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, ADMIN_OWNER_EMAIL: owner, ADMIN_ACCESS_EMAILS: `${owner},${translator}` };

let key: CryptoKey;
let getKey: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  key = pair.privateKey as CryptoKey;
  getKey = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'k', alg: 'RS256' }] });
  resetAccessSessionMemory();
});

afterAll(async () => {
  await prisma.adminUser.deleteMany({ where: { email: { in: [owner, translator] } } });
  await prisma.$disconnect();
});

const headers = async (email: string, iat = Math.floor(Date.now() / 1000)) => {
  const t = await new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: 'k' }).setIssuer(TEAM).setAudience(AUD).setSubject('s').setIssuedAt(iat).setExpirationTime(iat + 600).sign(key);
  return new Headers({ 'cf-access-jwt-assertion': t, 'cf-connecting-ip': '203.0.113.9' });
};
/** Every row of these accounts hashes correctly onto its predecessor (other suites may leave unchained rows elsewhere in the shared table). */
async function expectChainIntact() {
  const rows = await prisma.adminAuthEvent.findMany({ where: { email: { in: [owner, translator] } }, orderBy: { seq: 'asc' } });
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) {
    expect(chainHash(r.prevHash, canonicalEventString(r))).toBe(r.hash);
    if (r.prevHash) expect(await prisma.adminAuthEvent.findFirst({ where: { hash: r.prevHash } })).not.toBeNull();
  }
}
const resolve = (h: Headers) => resolveAccessSession(h, { env, getKey });

describe('access-mode sign-in against the real schema', () => {
  it('provisions the owner once, even for concurrent first requests', async () => {
    const [a, b, c] = await Promise.all([resolve(await headers(owner)), resolve(await headers(owner)), resolve(await headers(owner))]);
    const ids = new Set([a, b, c].map((r) => (r.ok ? r.session.user.id : 'fail')));
    expect(ids.size).toBe(1);
    expect(await prisma.adminUser.count({ where: { email: owner } })).toBe(1);
    expect(await prisma.adminUser.findUniqueOrThrow({ where: { email: owner } })).toMatchObject({ role: 'OWNER' });
  });

  it('writes one chained ADMIN_ACCESS_SIGN_IN per token', async () => {
    const t = await headers(owner, Math.floor(Date.now() / 1000) - 5);
    resetAccessSessionMemory();
    await resolve(t);
    await resolve(t);
    resetAccessSessionMemory(); // simulates a restart
    await resolve(t);
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: owner } });
    const rows = await prisma.adminAuthEvent.findMany({ where: { adminUserId: user.id, action: 'ADMIN_ACCESS_SIGN_IN' } });
    const mine = rows.filter((r) => r.reason?.includes(`iat ${Math.floor(Date.now() / 1000) - 5}`) || r.reason?.includes('iat '));
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(new Set(rows.map((r) => r.reason)).size).toBe(rows.length); // no duplicate fingerprint
    await expectChainIntact();
  });

  it('matches a translator by e-mail and refuses an allowed address without an account', async () => {
    expect(await resolve(await headers(translator))).toMatchObject({ ok: false, reason: 'no_account' });
    await prisma.adminUser.create({ data: { id: `${RUN}-t`, email: translator, name: 'T', role: 'TRANSLATOR' } });
    expect(await resolve(await headers(translator))).toMatchObject({ ok: true, session: { user: { role: 'TRANSLATOR' } } });
    expect(await prisma.adminUser.count({ where: { email: translator } })).toBe(1);
    await expectChainIntact();
  });
});
