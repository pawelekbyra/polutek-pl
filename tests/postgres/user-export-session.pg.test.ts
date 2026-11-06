import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const prisma = new PrismaClient();
const RUN = `user-export-session-${Date.now().toString(36)}`;
const secret = randomBytes(32).toString("base64url");
const token = randomBytes(32).toString("base64url");
let userId = "";
let getAuth: typeof import("@/lib/auth/server").getAuth;
let resolveDbBackedActor: typeof import("@/lib/api/auth").resolveDbBackedActor;

function requestWithSessionCookie(sessionToken: string, signingSecret = secret): Request {
  const signature = createHmac("sha256", signingSecret).update(sessionToken).digest("base64");
  return new Request("http://localhost/api/user/export", {
    headers: { cookie: `pp.session_token=${sessionToken}.${signature}` },
  });
}

beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET = secret;
  vi.resetModules();
  ({ getAuth } = await import("@/lib/auth/server"));
  ({ resolveDbBackedActor } = await import("@/lib/api/auth"));

  userId = `${RUN}-user`;
  await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test`, name: "Session owner" } });
  await prisma.session.create({ data: {
    id: `${RUN}-session`, token, userId, expiresAt: new Date(Date.now() + 60_000),
  } });
});

afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("K27 export session boundary (PostgreSQL + Better Auth)", () => {
  it("accepts a signed live cookie, resolves the DB actor, and rejects invalid or revoked sessions", async () => {
    const valid = await getAuth(requestWithSessionCookie(token), { fresh: true });
    expect(valid.userId).toBe(userId);
    expect(await resolveDbBackedActor(valid.userId!)).toMatchObject({ type: "user", userId });

    const invalid = await getAuth(requestWithSessionCookie(token, `${secret}-wrong`), { fresh: true });
    expect(invalid.userId).toBeNull();

    await prisma.session.deleteMany({ where: { token } });
    const revoked = await getAuth(requestWithSessionCookie(token), { fresh: true });
    expect(revoked.userId).toBeNull();
  });
});
