/**
 * Better Auth upgrade contract (docs/operations/BETTER-AUTH-UPGRADE.md).
 *
 * Runs the REAL Better Auth library with OUR configuration (lib/auth/auth.ts), only the database is
 * swapped for Better Auth's in-memory adapter. It pins what users and stored data depend on, so a
 * library update that changes any of it fails here instead of in production:
 *  - cookie names and attributes (`__Secure-pp.session_token`, cookie cache),
 *  - a session cookie signed before the update still opens the same session (nobody is signed out),
 *  - the session fields the app reads (lib/auth/server.ts, session-snapshot.ts),
 *  - the sign-up hook still stamps the Terms version, placeholder name, onboarding flag, avatar,
 *  - the origin (CSRF) check and Turnstile still refuse requests before any work is done,
 *  - TOTP codes and encrypted TOTP secrets of existing enrollments stay valid (site and admin panel).
 */
import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) =>
      // existingAccountCode (sign-up after hook) looks up by e-mail: the address is free.
      // beforeSessionCreate / nickname check look up by id: a live account that is still onboarding.
      where.email ? null : { isDeleted: false, onboardingPending: true, name: "anna", createdAt: new Date() },
    ),
    findFirst: vi.fn(async () => null),
    update: vi.fn(),
  },
  account: { findMany: vi.fn(async () => []), deleteMany: vi.fn() },
  session: { deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
  passkey: { deleteMany: vi.fn(), findUnique: vi.fn(async () => null) },
  $transaction: vi.fn(async () => []),
}));

const sendEmail = vi.hoisted(() => ({
  queueVerificationEmail: vi.fn(),
  queuePasswordResetEmail: vi.fn(),
  queuePasswordChangedEmail: vi.fn(),
  queueChangeEmailConfirmation: vi.fn(),
  onEmailVerified: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/emails", () => sendEmail);
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/rate-limit-storage", () => ({
  authRateLimitStorage: { get: vi.fn(), set: vi.fn() },
  hitAuthCounter: vi.fn(async () => 1),
  peekAuthCounter: vi.fn(async () => 0),
}));

const SECRET = "upgrade-contract-secret-0123456789abcdef";
const ORIGIN = "https://www.pawelperfect.com";
const SESSION_COOKIE = "__Secure-pp.session_token";
const SESSION_DATA_COOKIE = "__Secure-pp.session_data";
const EMAIL = "anna@example.test";

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;
type Instance = { handler: (request: Request) => Promise<Response>; api: { signUpEmail: (input: unknown) => Promise<unknown> } };

let db: Db;
let instance: Instance;

/** The cookie exactly as the browser holds it: `token.base64(HMAC-SHA256(token))`, URL-encoded. */
function signedSessionCookie(token: string, secret = SECRET) {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return `${SESSION_COOKIE}=${encodeURIComponent(`${token}.${signature}`)}`;
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function authRequest(path: string, init: { method?: string; cookie?: string; origin?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.origin) headers.set("origin", init.origin);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}/api/auth${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

beforeAll(async () => {
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TURNSTILE_SECRET_KEY", "BETTER_AUTH_URL", "BETTER_AUTH_TRUSTED_ORIGINS"]) vi.stubEnv(key, "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
  vi.resetModules();

  const { auth } = await import("@/lib/auth/auth");
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const options = auth.options as unknown as { plugins: Array<{ id: string }>; advanced: Record<string, unknown> } & Record<string, unknown>;

  db = { user: [], session: [], account: [], verification: [], twoFactor: [], passkey: [], rateLimit: [] };
  instance = betterAuth({
    ...options,
    database: memoryAdapter(db),
    // The production limiter needs Postgres; limits are covered in auth-instance.test.ts.
    rateLimit: { enabled: false },
    // Better Auth skips the origin check by default when it detects a test runner; production never
    // sets this option, so the check is on there. Turn it back on to test the production behaviour.
    advanced: { ...options.advanced, disableOriginCheck: false },
    // No network (Have I Been Pwned) and no Next.js request scope (nextCookies) in a unit test.
    plugins: options.plugins.filter((plugin) => plugin.id !== "have-i-been-pwned" && plugin.id !== "next-cookies"),
  } as never) as unknown as Instance;
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("Better Auth upgrade contract: sign-up and session", () => {
  let userId = "";
  const token = "contract-session-token-0123456789";

  it("e-mail sign-up runs our hook: Terms version, placeholder name, onboarding, avatar, language; no session before verification", async () => {
    const { LEGAL_DOCUMENTS_VERSION } = await import("@/lib/legal/version");
    const { DEFAULT_AVATAR_URL } = await import("@/lib/auth/avatar");
    const result = (await instance.api.signUpEmail({
      // The sign-up form sends the UI language; the name is replaced by a placeholder from the address.
      body: { email: EMAIL, password: "a-long-test-password-42", name: "Whatever The Client Sent", language: "pl" },
      headers: new Headers({ origin: ORIGIN }),
    })) as { token: string | null; user: { id: string } };

    expect(result.token).toBeNull(); // requireEmailVerification + autoSignIn: false
    expect(db.user).toHaveLength(1);
    const row = db.user[0]!;
    userId = String(row.id);
    expect(result.user.id).toBe(userId);
    expect(row).toMatchObject({
      email: EMAIL,
      name: "anna",
      emailVerified: false,
      onboardingPending: true,
      language: "pl",
      imageUrl: DEFAULT_AVATAR_URL,
      termsVersion: LEGAL_DOCUMENTS_VERSION,
    });
    expect(row.termsAcceptedAt).toBeInstanceOf(Date);
    expect(db.session).toHaveLength(0);
    await vi.waitFor(() => expect(sendEmail.queueVerificationEmail).toHaveBeenCalledTimes(1));
  });

  it("a session cookie signed before the update still opens the session, with the fields the app reads", async () => {
    const now = Date.now();
    db.user[0]!.emailVerified = true;
    db.session.push({
      id: "contract-session-id",
      token,
      userId,
      expiresAt: new Date(now + 30 * 24 * 3600 * 1000),
      createdAt: new Date(now),
      updatedAt: new Date(now),
      ipAddress: "203.0.113.7",
      userAgent: "contract-test",
    });

    const response = await instance.handler(authRequest("/get-session", { cookie: signedSessionCookie(token) }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { session: Row; user: Row } | null;
    expect(body?.session).toMatchObject({ id: "contract-session-id", userId, token });
    expect(new Date(String(body?.session.expiresAt)).getTime()).toBe(now + 30 * 24 * 3600 * 1000);
    expect(body?.user).toMatchObject({
      id: userId,
      email: EMAIL,
      emailVerified: true,
      image: "/default-avatar.jpg",
      language: "pl",
      onboardingPending: true,
      twoFactorEnabled: false,
    });
    expect(body?.user.createdAt).toBeTruthy();
    // returned: false in auth.ts: the Terms stamp never travels to the browser.
    expect(body?.user).not.toHaveProperty("termsVersion");
    expect(body?.user).not.toHaveProperty("termsAcceptedAt");

    // Cookie cache (60 s) is written with the production attributes.
    const cache = setCookies(response).find((cookie) => cookie.startsWith(`${SESSION_DATA_COOKIE}=`));
    expect(cache).toBeDefined();
    expect(cache).toMatch(/;\s*Max-Age=60(;|$)/i);
    expect(cache).toMatch(/;\s*Secure/i);
    expect(cache).toMatch(/;\s*HttpOnly/i);
    expect(cache).toMatch(/;\s*SameSite=Lax/i);
    expect(cache).toMatch(/;\s*Path=\//i);
  });

  it("the middleware's cookie check finds the production cookie", async () => {
    const { getSessionCookie } = await import("better-auth/cookies");
    const { SESSION_COOKIE_PREFIX } = await import("@/lib/auth/config");
    const withCookie = new Request(`${ORIGIN}/studio`, { headers: { cookie: signedSessionCookie(token) } });
    expect(getSessionCookie(withCookie, { cookiePrefix: SESSION_COOKIE_PREFIX })).toBeTruthy();
    expect(getSessionCookie(new Request(`${ORIGIN}/studio`), { cookiePrefix: SESSION_COOKIE_PREFIX })).toBeNull();
  });

  it("a guest and a forged cookie both get 200 with no session", async () => {
    const guest = await instance.handler(authRequest("/get-session"));
    expect(guest.status).toBe(200);
    expect(await guest.json()).toBeNull();

    const forged = await instance.handler(authRequest("/get-session", { cookie: signedSessionCookie(token, "another-secret-0123456789abcdef0123") }));
    expect(forged.status).toBe(200);
    expect(await forged.json()).toBeNull();
  });

  it("refuses a cross-site POST that carries the session cookie (origin check) and keeps the session", async () => {
    const response = await instance.handler(authRequest("/sign-out", { method: "POST", cookie: signedSessionCookie(token), origin: "https://evil.example", body: {} }));
    expect(response.status).toBe(403);
    expect(db.session.some((row) => row.token === token)).toBe(true);
  });

  it("sign-out from our own origin deletes the session row and expires the cookie", async () => {
    const response = await instance.handler(authRequest("/sign-out", { method: "POST", cookie: signedSessionCookie(token), origin: ORIGIN, body: {} }));
    expect(response.status).toBe(200);
    expect(db.session.some((row) => row.token === token)).toBe(false);
    const cleared = setCookies(response).find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
    expect(cleared).toMatch(/Max-Age=0/i);
  });
});

describe("Better Auth upgrade contract: Turnstile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("e-mail sign-in without a Turnstile answer is refused with 400 before Cloudflare or the database is asked", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    prisma.user.findUnique.mockClear();
    const response = await instance.handler(
      authRequest("/sign-in/email", { method: "POST", origin: ORIGIN, body: { email: EMAIL, password: "a-long-test-password-42" } }),
    );
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.session).toHaveLength(0);
  });
});

describe("Better Auth upgrade contract: TOTP of existing enrollments", () => {
  // RFC 6238 appendix B (SHA-1): the ASCII secret "12345678901234567890".
  const RFC_SECRET = "12345678901234567890";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates and verifies the RFC 6238 codes (site 2FA and the admin panel step-up use this)", async () => {
    const { createOTP } = await import("@better-auth/utils/otp");
    vi.spyOn(Date, "now").mockReturnValue(59_000);
    expect(await createOTP(RFC_SECRET, { digits: 8, period: 30 }).totp()).toBe("94287082");
    expect(await createOTP(RFC_SECRET, { digits: 6, period: 30 }).totp()).toBe("287082");
    expect(await createOTP(RFC_SECRET, { digits: 6, period: 30 }).verify("287082")).toBe(true);
    expect(await createOTP(RFC_SECRET, { digits: 6, period: 30 }).verify("287083")).toBe(false);

    vi.spyOn(Date, "now").mockReturnValue(1_111_111_109_000);
    expect(await createOTP(RFC_SECRET, { digits: 8, period: 30 }).totp()).toBe("07081804");
  });

  it("keeps the authenticator-app QR secret (Base32 of the stored secret)", async () => {
    const { createOTP } = await import("@better-auth/utils/otp");
    const url = new URL(createOTP(RFC_SECRET, { digits: 6, period: 30 }).url("Panel PP", "owner@example.test"));
    expect(url.searchParams.get("secret")).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("decrypts a TOTP secret encrypted by Better Auth 1.7.7 (rows already in TwoFactor / AdminTwoFactor)", async () => {
    const { symmetricDecrypt } = await import("better-auth/crypto");
    const storedBy177 =
      "f75c8de3ade64a17b75aa6af258dfc9140b7bd1171c8de6b10f97f324a4da857fb486f4307aab2a469e578969f3189712e061c564d671a678bcce01d";
    expect(await symmetricDecrypt({ key: SECRET, data: storedBy177 })).toBe(RFC_SECRET);
  });
});
