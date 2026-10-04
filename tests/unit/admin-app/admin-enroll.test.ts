import { describe, expect, it, vi } from "vitest";
import * as cli from "../../../apps/admin/scripts/admin-enroll.mjs";
import { canonicalEventString, chainHash } from "@admin/lib/auth/audit";
import { hashEnrollmentToken } from "@admin/lib/auth/panel-plugin";

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in for the Prisma calls admin-enroll makes (inside one $transaction). */
function fakePrisma(seed: { user?: Row } = {}) {
  const db = {
    users: seed.user ? [{ ...seed.user }] : ([] as Row[]),
    sessions: [{ userId: "u1" }] as Row[],
    passkeys: [{ userId: "u1" }] as Row[],
    twoFactors: [{ userId: "u1" }] as Row[],
    accounts: [] as Row[],
    enrollments: [{ userId: "u1", tokenHash: "old", usedAt: null }] as Row[],
    events: [] as Row[],
  };
  const drop = (list: Row[], userId: unknown) => {
    const before = list.length;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].userId === userId) list.splice(i, 1);
    return { count: before - list.length };
  };
  const tx = {
    $queryRaw: vi.fn(async () => [{}]),
    adminUser: {
      findUnique: async ({ where }: { where: { email: string } }) => db.users.find((u) => u.email === where.email) ?? null,
      create: async ({ data }: { data: Row }) => {
        const u = { enrolledAt: null, ...data };
        db.users.push(u);
        return u;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(db.users.find((u) => u.id === where.id)!, data),
    },
    adminSession: { deleteMany: async ({ where }: { where: Row }) => drop(db.sessions, where.userId) },
    adminPasskey: { deleteMany: async ({ where }: { where: Row }) => drop(db.passkeys, where.userId) },
    adminTwoFactor: { deleteMany: async ({ where }: { where: Row }) => drop(db.twoFactors, where.userId) },
    adminAccount: { deleteMany: async ({ where }: { where: Row }) => drop(db.accounts, where.userId) },
    adminEnrollment: {
      deleteMany: async ({ where }: { where: Row }) => {
        const before = db.enrollments.length;
        db.enrollments = db.enrollments.filter((e) => !(e.userId === where.userId && e.usedAt === null));
        return { count: before - db.enrollments.length };
      },
      create: async ({ data }: { data: Row }) => {
        db.enrollments.push({ usedAt: null, ...data });
        return data;
      },
    },
    adminAuthEvent: {
      findFirst: async () => (db.events.length ? db.events[db.events.length - 1] : null),
      create: async ({ data }: { data: Row }) => {
        db.events.push(data);
        return data;
      },
    },
  };
  const prisma = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  return { prisma, db };
}

describe("admin-enroll CLI", () => {
  it("parses arguments and rejects a missing or bad e-mail", () => {
    expect(cli.parseArgs(["--email", "Pawel.Perfect@Gmail.com", "--reset"])).toMatchObject({ email: "pawel.perfect@gmail.com", reset: true });
    expect(cli.parseArgs(["--email=a@b.pl", "--name=Paweł"])).toMatchObject({ email: "a@b.pl", name: "Paweł", reset: false });
    expect(() => cli.parseArgs([])).toThrow(/--email/);
    expect(() => cli.parseArgs(["--email", "nope"])).toThrow();
    expect(() => cli.parseArgs(["--email", "a@b.pl", "--admin"])).toThrow(/Nieznany/);
  });

  it("hashes tokens exactly like the server-side redeem endpoint", () => {
    const token = cli.newEnrollmentToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cli.hashEnrollmentToken(token)).toBe(hashEnrollmentToken(token));
  });

  it("chains audit rows exactly like the panel (one hash chain for CLI and web)", () => {
    const row = { action: "ADMIN_ENROLL_ISSUED", outcome: "success", adminUserId: "u1", email: "a@b.pl", reason: "cli", ip: null, country: null, userAgent: "admin-enroll", requestId: null, createdAt: new Date("2026-10-04T10:00:00Z") };
    expect(cli.canonicalEventString(row)).toBe(canonicalEventString(row));
    expect(cli.chainHash("prev", cli.canonicalEventString(row))).toBe(chainHash("prev", canonicalEventString(row)));
    expect(chainHash(null, "x")).not.toBe(chainHash("other", "x"));
  });

  it("creates the account and stores only the hash of a 15-minute token", async () => {
    const { prisma, db } = fakePrisma();
    const now = new Date("2026-10-04T10:00:00Z");
    const { token, expiresAt } = await cli.issueEnrollment(prisma, { email: "owner@example.com", name: null, reset: false, now });
    expect(db.users).toHaveLength(1);
    const stored = db.enrollments.find((e) => e.userId === db.users[0].id)!;
    expect(stored.tokenHash).toBe(cli.hashEnrollmentToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(expiresAt.getTime() - now.getTime()).toBe(15 * 60 * 1000);
    expect(db.events[0]).toMatchObject({ action: "ADMIN_ENROLL_ISSUED", prevHash: null });
  });

  it("refuses to re-issue for a finished enrollment without --reset", async () => {
    const { prisma } = fakePrisma({ user: { id: "u1", email: "owner@example.com", enrolledAt: new Date() } });
    await expect(cli.issueEnrollment(prisma, { email: "owner@example.com", reset: false })).rejects.toThrow(/--reset/);
  });

  it("--reset cuts off every session, passkey and TOTP and voids older links", async () => {
    const { prisma, db } = fakePrisma({ user: { id: "u1", email: "owner@example.com", enrolledAt: new Date() } });
    await cli.issueEnrollment(prisma, { email: "owner@example.com", reset: true });
    expect(db.sessions).toHaveLength(0);
    expect(db.passkeys).toHaveLength(0);
    expect(db.twoFactors).toHaveLength(0);
    expect(db.users[0].enrolledAt).toBeNull();
    expect(db.enrollments.some((e) => e.tokenHash === "old")).toBe(false);
    expect(db.events[0]).toMatchObject({ action: "ADMIN_ENROLL_RESET" });
  });

  it("drops anything an unfinished enrollment registered when a new link is issued", async () => {
    const { prisma, db } = fakePrisma({ user: { id: "u1", email: "owner@example.com", enrolledAt: null } });
    await cli.issueEnrollment(prisma, { email: "owner@example.com", reset: false });
    expect(db.passkeys).toHaveLength(0);
    expect(db.sessions).toHaveLength(0);
  });
});
