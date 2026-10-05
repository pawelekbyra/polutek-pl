/** Dead login screens in access mode: redirect or explain, never a passkey prompt; /api/auth is closed. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { to }); } }));
vi.mock("@admin/lib/auth/access-session", async (orig) => ({ ...(await orig<typeof import("@admin/lib/auth/access-session")>()), resolveAccessSession: h.resolve }));
vi.mock("@admin/lib/auth/auth", () => ({ adminAuth: { handler: vi.fn(async () => new Response("legacy", { status: 200 })), api: {} } }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@admin/components/auth/enroll-flow", () => ({ EnrollFlow: () => null }));
vi.mock("@admin/components/auth/sign-in-card", () => ({ SignInCard: () => null, AuthBrand: () => null }));

import SignInPage from "../../../apps/admin/app/(auth)/logowanie/page";
import EnrollPage from "../../../apps/admin/app/(auth)/rejestracja/page";
import { GET, POST } from "../../../apps/admin/app/api/auth/[...all]/route";

const target = async (p: Promise<unknown>) => p.then(() => null, (e: { to?: string }) => e.to ?? "other");

beforeEach(() => vi.stubEnv("NODE_ENV", "production"));
afterEach(() => vi.unstubAllEnvs());

describe("access mode", () => {
  it("/logowanie sends a signed-in person on, and explains instead of showing a passkey prompt otherwise", async () => {
    h.resolve.mockResolvedValue({ ok: true, session: {} });
    expect(await target(SignInPage({ searchParams: Promise.resolve({ next: "/przychody" }) }))).toBe("/przychody");
    h.resolve.mockResolvedValue({ ok: false, reason: "no_account", email: "x@example.test" });
    const el = (await SignInPage({ searchParams: Promise.resolve({}) })) as { props: { kind: string; email: string } };
    expect(el.props).toMatchObject({ kind: "no_account", email: "x@example.test" });
  });

  it("/rejestracja redirects to the panel", async () => {
    expect(await target(EnrollPage())).toBe("/");
  });

  it("/api/auth answers 404 (no passkey, TOTP or enrollment endpoints)", async () => {
    expect((await GET(new Request("https://admin.pawelperfect.com/api/auth/get-session"))).status).toBe(404);
    expect((await POST(new Request("https://admin.pawelperfect.com/api/auth/enrollment/redeem", { method: "POST" }))).status).toBe(404);
  });
});

describe("legacy passkey mode", () => {
  beforeEach(() => vi.stubEnv("ADMIN_AUTH_MODE", "passkey"));
  it("keeps /api/auth open", async () => {
    expect((await GET(new Request("https://admin.pawelperfect.com/api/auth/get-session"))).status).toBe(200);
  });
});
