/** AUTH-02/03/30: changing the e-mail needs re-authentication and is rate limited; reset/verification mails are limited per address. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: {
    account: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
  },
  getSession: vi.fn(),
  hit: vi.fn(),
  peek: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/emails", () => ({ queuePasswordChangedEmail: vi.fn() }));
vi.mock("@/lib/auth/rate-limit-storage", () => ({ hitAuthCounter: h.hit, peekAuthCounter: h.peek }));
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getSessionFromCtx: h.getSession,
}));

import { assertMailToAddressAllowed, countMailToAddress, guardChangeEmail } from "@/lib/auth/hooks";

const NOW = Date.now();
const verify = vi.fn();

function ctx(body: Record<string, unknown>) {
  return { body, context: { password: { verify } } } as never;
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return (error as { body?: { code?: string } }).body?.code ?? String(error);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });
  h.hit.mockResolvedValue(1);
  h.peek.mockResolvedValue(0);
});

describe("guardChangeEmail", () => {
  it("refuses a password account without the password, and with a wrong one", async () => {
    h.prisma.account.findFirst.mockResolvedValue({ password: "hash" });
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl" })))).toBe("PASSWORD_REQUIRED");
    verify.mockResolvedValue(false);
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl", password: "nope" })))).toBe("INVALID_PASSWORD");
  });

  it("lets a password account through with the right password", async () => {
    h.prisma.account.findFirst.mockResolvedValue({ password: "hash" });
    verify.mockResolvedValue(true);
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl", password: "right one 123" })))).toBe("ok");
    expect(verify).toHaveBeenCalledWith({ hash: "hash", password: "right one 123" });
  });

  it("wants a fresh sign-in from a Google-only account (a stolen old session is not enough)", async () => {
    h.prisma.account.findFirst.mockResolvedValue(null);
    h.prisma.session.findUnique.mockResolvedValue({ createdAt: new Date(NOW - 60 * 60 * 1000) });
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl" })))).toBe("REAUTH_REQUIRED");
    h.prisma.session.findUnique.mockResolvedValue({ createdAt: new Date(NOW - 60 * 1000) });
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl" })))).toBe("ok");
  });

  it("limits requests per user before checking the password", async () => {
    h.hit.mockResolvedValue(6);
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl", password: "pw" })))).toBe("TOO_MANY_ATTEMPTS");
    expect(h.hit).toHaveBeenCalledWith("change-email:u1", 3600);
    expect(h.prisma.account.findFirst).not.toHaveBeenCalled();
  });

  it("leaves a request without a session to the endpoint (401)", async () => {
    h.getSession.mockResolvedValue(null);
    expect(await codeOf(guardChangeEmail(ctx({ newEmail: "x@y.pl" })))).toBe("ok");
    expect(h.hit).not.toHaveBeenCalled();
  });
});

describe("mails to a typed-in address", () => {
  it("block the address after the limit, counted per hashed address (never the raw e-mail)", async () => {
    h.peek.mockResolvedValue(5);
    expect(await codeOf(assertMailToAddressAllowed("Victim@B.pl"))).toBe("TOO_MANY_ATTEMPTS");
    const key = h.peek.mock.calls[0][0] as string;
    expect(key).toMatch(/^mail-to:[0-9a-f]{32}$/);
    expect(key).not.toContain("victim");
  });

  it("count only requests that went through (after Turnstile), not failed ones", async () => {
    await countMailToAddress("a@b.pl", new Error("captcha failed"));
    expect(h.hit).not.toHaveBeenCalled();
    await countMailToAddress("a@b.pl", { status: true });
    expect(h.hit).toHaveBeenCalledWith(expect.stringMatching(/^mail-to:/), 3600);
  });
});
