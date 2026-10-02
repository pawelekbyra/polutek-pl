import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
const mail = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({}),
  sendAccountExistsEmail: vi.fn().mockResolvedValue({}),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue({}),
  sendWelcomeEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/modules/email", () => mail);

import {
  queueAccountExistsEmail,
  queuePasswordChangedEmail,
  queuePasswordResetEmail,
  queueVerificationEmail,
  queueWelcomeEmail,
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

  it("tell an existing owner about a repeated sign-up with a link to the site, not to a token", async () => {
    prisma.user.findUnique.mockResolvedValue({ language: "en" });
    queueAccountExistsEmail({ email: "owner@b.pl" });
    await flush();
    expect(mail.sendAccountExistsEmail).toHaveBeenCalledWith("owner@b.pl", "https://www.pawelperfect.com/", "en");
  });

  it("never throw into the auth flow when sending fails and return before the send completes", async () => {
    prisma.user.findUnique.mockResolvedValue({ language: "pl" });
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error("resend down"));
    expect(() => queueVerificationEmail({ email: "a@b.pl" }, "https://x/v")).not.toThrow();
    expect(queueVerificationEmail({ email: "a@b.pl" }, "https://x/v")).toBeUndefined();
    await flush();
  });

  it("sends the welcome mail with the nickname in the user's language", async () => {
    queueWelcomeEmail({ email: "a@b.pl", name: "Nick", language: "pl" });
    await flush();
    expect(mail.sendWelcomeEmail).toHaveBeenCalledWith("a@b.pl", "Nick", "pl");
  });
});
