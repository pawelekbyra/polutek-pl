import { describe, expect, it, vi } from "vitest";
import * as cli from "../../../apps/admin/scripts/admin-enroll.mjs";

describe("admin-enroll roles", () => {
  it("parses a translator with languages and refuses nonsense", () => {
    expect(cli.parseArgs(["--email", "t@x.pl", "--role", "translator", "--languages", "de, ES"])).toMatchObject({ role: "TRANSLATOR", languages: ["de", "es"] });
    expect(() => cli.parseArgs(["--email", "t@x.pl", "--role", "translator"])).toThrow(/języków/);
    expect(() => cli.parseArgs(["--email", "t@x.pl", "--role", "translator", "--languages", "xx"])).toThrow(/Nieznane języki/);
    expect(() => cli.parseArgs(["--email", "t@x.pl", "--languages", "de"])).toThrow(/tylko z --role/);
    expect(() => cli.parseArgs(["--email", "t@x.pl", "--role", "root"])).toThrow(/owner albo translator/);
    expect(cli.parseArgs(["--email", "o@x.pl"])).toMatchObject({ role: null, languages: [] });
  });

  it("creates a translator with exactly the requested grants and drops grants for an owner", async () => {
    const calls: string[] = [];
    const tx = {
      adminUser: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: { role?: string } }) => ({ id: "u1", enrolledAt: null, role: data.role })), update: vi.fn(async () => ({ id: "u1", enrolledAt: null })) },
      adminLanguageGrant: { deleteMany: vi.fn(async () => calls.push("delete")), createMany: vi.fn(async ({ data }: { data: unknown[] }) => calls.push(`create:${data.length}`)) },
      adminSession: { deleteMany: vi.fn() }, adminPasskey: { deleteMany: vi.fn() }, adminTwoFactor: { deleteMany: vi.fn() }, adminAccount: { deleteMany: vi.fn() },
      adminEnrollment: { deleteMany: vi.fn(), create: vi.fn() },
      adminAuthEvent: { findFirst: vi.fn(async () => null), create: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const prisma = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
    await cli.issueEnrollment(prisma, { email: "t@x.pl", role: "TRANSLATOR", languages: ["de", "es"] });
    expect(tx.adminUser.create).toHaveBeenCalledWith({ data: expect.objectContaining({ role: "TRANSLATOR", name: "Tłumacz" }) });
    expect(calls).toEqual(["delete", "create:2"]);
    calls.length = 0;
    await cli.issueEnrollment(prisma, { email: "o@x.pl", role: "OWNER" });
    expect(calls).toEqual(["delete"]);
  });
});
