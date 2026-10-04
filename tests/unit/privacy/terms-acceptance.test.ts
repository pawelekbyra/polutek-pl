import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { recordTermsAcceptance } from "@/lib/modules/users";
import { LEGAL_DOCUMENTS_VERSION, formatLegalDateEn, formatLegalDatePl } from "@/lib/legal/version";
import { LEGAL_EFFECTIVE_DATE, LEGAL_EFFECTIVE_DATE_EN } from "@/app/components/legal/LegalDocs";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const NOW = new Date("2026-10-05T10:00:00Z");

function ctxWith(user: { id: string; isDeleted: boolean; termsVersion: string | null; termsAcceptedAt: Date | null }) {
  const prisma = {
    user: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        const versionDiffers = where.OR.some((c: any) => (c.termsVersion === null ? user.termsVersion === null : user.termsVersion !== c.termsVersion.not));
        if (where.id !== user.id || user.isDeleted !== where.isDeleted || !versionDiffers) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      }),
    },
  };
  return createAppContext({ actor: { type: "user", userId: user.id }, prisma: prisma as never, now: () => NOW });
}

describe("Terms acceptance from the tip gate", () => {
  it("records the current version for an account that has none (accounts from before 2026-10-04)", async () => {
    const user = { id: "u1", isDeleted: false, termsVersion: null, termsAcceptedAt: null };
    expect(await recordTermsAcceptance(ctxWith(user), "u1", LEGAL_DOCUMENTS_VERSION)).toBe(true);
    expect(user).toMatchObject({ termsVersion: LEGAL_DOCUMENTS_VERSION, termsAcceptedAt: NOW });
  });

  it("updates an older accepted version but keeps the original date of the same version", async () => {
    const older = { id: "u1", isDeleted: false, termsVersion: "2026-09-26", termsAcceptedAt: new Date(0) };
    expect(await recordTermsAcceptance(ctxWith(older), "u1", LEGAL_DOCUMENTS_VERSION)).toBe(true);
    expect(older.termsVersion).toBe(LEGAL_DOCUMENTS_VERSION);

    const first = new Date("2026-10-04T08:00:00Z");
    const same = { id: "u1", isDeleted: false, termsVersion: LEGAL_DOCUMENTS_VERSION, termsAcceptedAt: first };
    expect(await recordTermsAcceptance(ctxWith(same), "u1", LEGAL_DOCUMENTS_VERSION)).toBe(false);
    expect(same.termsAcceptedAt).toBe(first);
  });

  it("ignores a version that is not the current one (stale or forged client)", async () => {
    const user = { id: "u1", isDeleted: false, termsVersion: null, termsAcceptedAt: null };
    expect(await recordTermsAcceptance(ctxWith(user), "u1", "2020-01-01")).toBe(false);
    expect(user.termsVersion).toBeNull();
  });
});

describe("legal documents version", () => {
  it("the date printed on the documents is the recorded version", () => {
    expect(LEGAL_DOCUMENTS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEGAL_EFFECTIVE_DATE).toBe(`Obowiązuje od ${formatLegalDatePl()} r.`);
    expect(LEGAL_EFFECTIVE_DATE_EN).toBe(`Effective as of ${formatLegalDateEn()}.`);
    expect(formatLegalDatePl("2026-10-04")).toBe("4 października 2026");
    expect(formatLegalDateEn("2026-10-04")).toBe("4 October 2026");
  });
});
