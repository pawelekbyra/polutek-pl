import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  session: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
}));
const mail = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({}),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue({}),
  sendChangeEmailConfirmationEmail: vi.fn().mockResolvedValue({}),
  sendChangeEmailVerificationEmail: vi.fn().mockResolvedValue({}),
  sendEmailChangedEmail: vi.fn().mockResolvedValue({}),
}));
const audit = vi.hoisted(() => ({ recordAuthAudit: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/modules/email", () => mail);
vi.mock("@/lib/auth/audit", () => audit);

import {
  onEmailVerified,
  queueChangeEmailConfirmation,
  queuePasswordChangedEmail,
  queuePasswordResetEmail,
  queueVerificationEmail,
} from "@/lib/auth/emails";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A Better Auth e-mail link with the given claims (the signature is irrelevant here). */
function emailLink(claims: Record<string, string>) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `https://www.pawelperfect.com/api/auth/verify-email?token=h.${payload}.s&callbackURL=%2F`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.pawelperfect.com");
});

describe("auth e-mails", () => {
  it("send in the saved language of the recipient (PL)", async () => {
    prisma.user.findUnique.mockResolvedValue({ language: "pl" });
    queueVerificationEmail({ email: "a@b.pl" }, "https://x/verify");
    queuePasswordResetEmail({ email: "a@b.pl" }, "https://x/reset");
    queuePasswordChangedEmail({ email: "a@b.pl" });
    await flush();
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith("a@b.pl", "https://x/verify", "pl");
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith("a@b.pl", "https://x/reset", "pl");
    expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith("a@b.pl", "pl");
  });

  it("fall back to English for unknown recipients or a failed lookup", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    queueVerificationEmail({ email: "new@b.pl" }, "https://x/v");
    await flush();
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith("new@b.pl", "https://x/v", "en");
    prisma.user.findUnique.mockRejectedValueOnce(new Error("db down"));
    queuePasswordResetEmail({ email: "x@b.pl" }, "https://x/r");
    await flush();
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith("x@b.pl", "https://x/r", "en");
  });

  it("never throw into the auth flow when sending fails and return before the send completes", async () => {
    prisma.user.findUnique.mockResolvedValue({ language: "pl" });
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error("resend down"));
    expect(() => queueVerificationEmail({ email: "a@b.pl" }, "https://x/v")).not.toThrow();
    expect(queueVerificationEmail({ email: "a@b.pl" }, "https://x/v")).toBeUndefined();
    await flush();
  });

  it("approves an e-mail change from the CURRENT address, in the account language (AUTH-02, F-15)", async () => {
    queueChangeEmailConfirmation({ id: "u1", email: "old@b.pl", language: "pl" }, "new@b.pl", "https://x/approve");
    await flush();
    expect(mail.sendChangeEmailConfirmationEmail).toHaveBeenCalledWith("old@b.pl", "new@b.pl", "https://x/approve", "pl");
  });

  it("confirms the NEW address with its own template and the language looked up by account id", async () => {
    prisma.user.findUnique.mockResolvedValue({ language: "pl" });
    const url = emailLink({ email: "old@b.pl", updateTo: "new@b.pl", requestType: "change-email-verification" });
    queueVerificationEmail({ id: "u1", email: "new@b.pl" }, url);
    await flush();
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" } }));
    expect(mail.sendChangeEmailVerificationEmail).toHaveBeenCalledWith("new@b.pl", url, "pl");
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("tells the OLD address once the change is done and audits it", async () => {
    const request = new Request(emailLink({ email: "old@b.pl", updateTo: "new@b.pl", requestType: "change-email-verification" }));
    await onEmailVerified({ id: "u1", email: "new@b.pl", language: "en" }, request);
    await flush();
    expect(mail.sendEmailChangedEmail).toHaveBeenCalledWith("old@b.pl", "new@b.pl", "en");
    expect(audit.recordAuthAudit).toHaveBeenCalledWith({ action: "AUTH_EMAIL_CHANGED", userId: "u1" });
  });

  it("signs the other devices out after an e-mail change and keeps the session of this browser", async () => {
    prisma.session.findMany.mockResolvedValueOnce([
      { id: "s-newest", token: "tok-newest" },
      { id: "s-this", token: "tok-this" },
      { id: "s-other", token: "tok-other" },
    ]);
    const request = new Request(emailLink({ email: "old@b.pl", updateTo: "new@b.pl", requestType: "change-email-verification" }), {
      headers: { cookie: "__Secure-pp.session_token=tok-this.signature; pp.session_token=tok-this.signature" },
    });
    await onEmailVerified({ id: "u1", email: "new@b.pl", language: "en" }, request);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", id: { not: "s-this" } } });
  });

  it("keeps the session Better Auth has just created when the link is opened without a session", async () => {
    prisma.session.findMany.mockResolvedValueOnce([
      { id: "s-created-now", token: "tok-new" },
      { id: "s-old", token: "tok-old" },
    ]);
    const request = new Request(emailLink({ email: "old@b.pl", updateTo: "new@b.pl", requestType: "change-email-verification" }));
    await onEmailVerified({ id: "u1", email: "new@b.pl", language: "en" }, request);
    expect(prisma.session.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" }, orderBy: { createdAt: "desc" } }));
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", id: { not: "s-created-now" } } });
  });

  it("still notifies and audits when signing the other devices out fails", async () => {
    prisma.session.findMany.mockRejectedValueOnce(new Error("db down"));
    const request = new Request(emailLink({ email: "old@b.pl", updateTo: "new@b.pl", requestType: "change-email-verification" }));
    await onEmailVerified({ id: "u1", email: "new@b.pl", language: "en" }, request);
    await flush();
    expect(mail.sendEmailChangedEmail).toHaveBeenCalled();
    expect(audit.recordAuthAudit).toHaveBeenCalledWith({ action: "AUTH_EMAIL_CHANGED", userId: "u1" });
  });

  it("does nothing extra after a plain sign-up verification", async () => {
    await onEmailVerified({ id: "u1", email: "a@b.pl" }, new Request(emailLink({ email: "a@b.pl" })));
    await flush();
    expect(mail.sendEmailChangedEmail).not.toHaveBeenCalled();
    expect(audit.recordAuthAudit).not.toHaveBeenCalled();
  });
});
