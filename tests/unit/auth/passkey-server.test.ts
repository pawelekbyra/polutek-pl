import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: { passkey: { findUnique: vi.fn() } },
  getSessionFromCtx: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getSessionFromCtx: h.getSessionFromCtx,
}));

import {
  assertFreshSessionIfSignedIn,
  assertPasskeyUserVerified,
  auditPasskeyEvent,
  isSessionFresh,
  normalizePasskeyName,
  sanitizePasskeyRegistrationBody,
  stripPasskeyOptionsName,
} from "@/lib/auth/passkey";
import { recordAuthAudit } from "@/lib/auth/audit";
import { PASSKEY_NAME_MAX_LENGTH, SESSION_FRESH_AGE_SECONDS } from "@/lib/auth/config";

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("passkey names and request bodies", () => {
  it("stores a trimmed, single-line name of bounded length", () => {
    expect(normalizePasskeyName("  iPhone\n\t· Safari  ")).toBe("iPhone · Safari");
    expect(normalizePasskeyName("x".repeat(200))).toHaveLength(PASSKEY_NAME_MAX_LENGTH);
    expect(normalizePasskeyName("   ")).toBeUndefined();
    expect(normalizePasskeyName(42)).toBeUndefined();
  });

  it("never lets the client ask for a second session when adding a key", () => {
    expect(sanitizePasskeyRegistrationBody({ response: { id: "c" }, name: " Mac ", createSession: true })).toEqual({
      response: { id: "c" },
      name: "Mac",
      createSession: false,
    });
    // An empty string, not undefined: Better Auth merges the hook's output over the client's body.
    expect(sanitizePasskeyRegistrationBody({ name: "  \n " })).toEqual({ name: "", createSession: false });
    expect(sanitizePasskeyRegistrationBody(undefined)).toEqual({ name: "", createSession: false });
  });

  it("keeps the e-mail as the WebAuthn user name (drops ?name= from the options request)", () => {
    expect(stripPasskeyOptionsName({ name: "My phone", authenticatorAttachment: "platform" })).toEqual({ name: "", authenticatorAttachment: "platform" });
    expect(stripPasskeyOptionsName(undefined)).toEqual({ name: "" });
  });
});

describe("fresh session for adding or removing a passkey on a signed-in account", () => {
  it("follows Better Auth's freshAge rule on the session creation time", () => {
    expect(isSessionFresh(new Date(NOW - 60_000), NOW)).toBe(true);
    expect(isSessionFresh(new Date(NOW - SESSION_FRESH_AGE_SECONDS * 1000), NOW)).toBe(false);
  });

  it("refuses with SESSION_NOT_FRESH when the session is older than freshAge", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    h.getSessionFromCtx.mockResolvedValue({ session: { id: "s1", createdAt: new Date(NOW - 2 * SESSION_FRESH_AGE_SECONDS * 1000) }, user: { id: "u1" } });
    await expect(assertFreshSessionIfSignedIn({} as never)).rejects.toMatchObject({ body: { code: "SESSION_NOT_FRESH" } });

    h.getSessionFromCtx.mockResolvedValue({ session: { id: "s1", createdAt: new Date(NOW - 60_000) }, user: { id: "u1" } });
    await expect(assertFreshSessionIfSignedIn({} as never)).resolves.toBeUndefined();

    // No session: nothing to check (delete answers 401 itself; registration then needs a sign-up token).
    h.getSessionFromCtx.mockResolvedValue(null);
    await expect(assertFreshSessionIfSignedIn({} as never)).resolves.toBeUndefined();
  });
});

describe("user verification", () => {
  it("requires the UV flag (biometrics or device PIN)", () => {
    expect(() => assertPasskeyUserVerified(false)).toThrow();
    expect(() => assertPasskeyUserVerified(undefined)).toThrow();
    expect(() => assertPasskeyUserVerified(true)).not.toThrow();
  });
});

describe("passkey audit events", () => {
  it("records AUTH_PASSKEY_ADDED with ids only", async () => {
    await auditPasskeyEvent({
      path: "/passkey/verify-registration",
      body: { response: { id: "cred-1" }, name: "iPhone" },
      context: { returned: { id: "pk1", userId: "u1", publicKey: "SECRET-LOOKING", credentialID: "cred-1" } },
    });
    expect(recordAuthAudit).toHaveBeenCalledWith({ action: "AUTH_PASSKEY_ADDED", userId: "u1", metadata: { passkeyId: "pk1" } });
  });

  it("records AUTH_PASSKEY_REMOVED for the signed-in owner", async () => {
    await auditPasskeyEvent({
      path: "/passkey/delete-passkey",
      body: { id: "pk1" },
      context: { returned: { status: true }, session: { user: { id: "u1" } } },
    });
    expect(recordAuthAudit).toHaveBeenCalledWith({ action: "AUTH_PASSKEY_REMOVED", userId: "u1", metadata: { passkeyId: "pk1" } });
  });

  it("records AUTH_PASSKEY_SIGN_IN with the passkey id looked up by credential", async () => {
    h.prisma.passkey.findUnique.mockResolvedValue({ id: "pk1" });
    await auditPasskeyEvent({
      path: "/passkey/verify-authentication",
      body: { response: { id: "cred-1", response: { signature: "sig" } } },
      context: { returned: { user: { id: "u1" } }, newSession: { user: { id: "u1" } } },
    });
    expect(h.prisma.passkey.findUnique).toHaveBeenCalledWith({ where: { credentialID: "cred-1" }, select: { id: true } });
    expect(recordAuthAudit).toHaveBeenCalledWith({ action: "AUTH_PASSKEY_SIGN_IN", userId: "u1", metadata: { passkeyId: "pk1" } });
  });

  it("records nothing for a failed ceremony", async () => {
    for (const path of ["/passkey/verify-registration", "/passkey/delete-passkey", "/passkey/verify-authentication"]) {
      await auditPasskeyEvent({ path, body: {}, context: { returned: new Error("PASSKEY_NOT_FOUND") } });
    }
    expect(recordAuthAudit).not.toHaveBeenCalled();
  });
});
