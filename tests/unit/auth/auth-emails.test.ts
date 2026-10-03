import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
const mail = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({}),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue({}),
  resolveEmailLanguage: (language: string | null | undefined) => (language === "pl" ? "pl" : "en"),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/modules/email", () => mail);

import {
  queuePasswordChangedEmail,
  queuePasswordResetEmail,
  queueVerificationEmail,
} from "@/lib/auth/emails";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
});
