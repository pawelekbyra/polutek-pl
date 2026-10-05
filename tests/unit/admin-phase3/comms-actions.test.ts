import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  email: { upsertEmailTemplate: vi.fn(), deleteEmailTemplate: vi.fn(), sendBroadcastTest: vi.fn(), createBroadcast: vi.fn(), cancelBroadcast: vi.fn() },
  guard: { requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "owner@example.com", name: "Właściciel", sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-ray": "r1" }) }));
vi.mock("@/lib/modules/email", () => m.email);
vi.mock("@admin/lib/auth/guard", () => m.guard);

import { cancelBroadcastAction, createBroadcastAction, resetTemplateAction, saveTemplateAction, sendBroadcastTestAction } from "@admin/app/(panel)/komunikacja/actions";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const KEY = "0b9a6a8e-1111-4222-8333-123456789abc";
const content = { subjectPl: "Premiera", htmlPl: "<p>Hej {{firstName}}</p>", subjectEn: "", htmlEn: "" };

function form(over: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ slug: "welcome-email", name: "", description: "", subject: "Cześć", html: "<p>Hej</p>", subjectEn: "", htmlEn: "", ...over })) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.ADMIN_DEV_FIXTURES;
  m.guard.hasFreshStepUp.mockResolvedValue(true);
});

describe("template actions", () => {
  it("saves a valid template through the use case and passes null for empty English fields", async () => {
    m.email.upsertEmailTemplate.mockResolvedValue(ok({}));
    expect(await saveTemplateAction(null, form())).toMatchObject({ ok: true });
    expect(m.email.upsertEmailTemplate).toHaveBeenCalledWith(expect.objectContaining({ actor: { type: "admin", userId: "adm1" } }), expect.objectContaining({ slug: "welcome-email", subjectEn: null, htmlEn: null }));
  });

  it("refuses a bad slug, a missing subject and a half-filled English version before calling the use case", async () => {
    expect(await saveTemplateAction(null, form({ slug: "Bad Slug!" }))).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    expect(await saveTemplateAction(null, form({ subject: "" }))).toMatchObject({ ok: false, fieldErrors: { subject: expect.any(String) } });
    expect(await saveTemplateAction(null, form({ subjectEn: "Hi" }))).toMatchObject({ ok: false, message: expect.stringContaining("angielska") });
    expect(m.email.upsertEmailTemplate).not.toHaveBeenCalled();
  });

  it("shows the unknown-variable error on the HTML field", async () => {
    m.email.upsertEmailTemplate.mockResolvedValue({ ok: false, error: { code: "EMAIL_TEMPLATE_INVALID_VARIABLES", message: "Szablon ma błędne zmienne (nieznane zmienne: {{x}})." } });
    expect(await saveTemplateAction(null, form({ html: "{{x}}" }))).toMatchObject({ ok: false, fieldErrors: { html: expect.stringContaining("{{x}}") } });
  });

  it("restores the default and reports a missing override politely", async () => {
    m.email.deleteEmailTemplate.mockResolvedValue(ok({ success: true, restoredDefault: true }));
    expect(await resetTemplateAction({ slug: "welcome-email" })).toMatchObject({ ok: true, message: "Przywrócono tekst domyślny." });
    m.email.deleteEmailTemplate.mockResolvedValue({ ok: false, error: { code: "EMAIL_TEMPLATE_NOT_FOUND", message: "x" } });
    expect(await resetTemplateAction({ slug: "welcome-email" })).toMatchObject({ ok: false, message: expect.stringContaining("już nie istnieje") });
  });
});

describe("broadcast actions", () => {
  it("test mail goes to the signed-in panel account only, whatever the request says", async () => {
    m.email.sendBroadcastTest.mockResolvedValue(ok({ messageId: "e1", to: "owner@example.com" }));
    const r = await sendBroadcastTestAction({ ...content, language: "pl", recipient: { email: "victim@example.com" } } as never);
    expect(r.ok).toBe(false); // .strict(): a forged recipient field is rejected outright
    expect(m.email.sendBroadcastTest).not.toHaveBeenCalled();
    expect(await sendBroadcastTestAction({ ...content, language: "pl" })).toMatchObject({ ok: true, message: expect.stringContaining("owner@example.com") });
    expect(m.email.sendBroadcastTest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ recipient: { email: "owner@example.com", name: "Właściciel" } }));
  });

  it("the test mail is rate limited (6 per 10 minutes)", async () => {
    m.email.sendBroadcastTest.mockResolvedValue(ok({}));
    for (let i = 0; i < 6; i++) await sendBroadcastTestAction({ ...content, language: "pl" });
    expect(await sendBroadcastTestAction({ ...content, language: "pl" })).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(m.email.sendBroadcastTest).toHaveBeenCalledTimes(6);
  });

  it("creating a broadcast needs a fresh step-up and a request key", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await createBroadcastAction({ ...content, requestKey: KEY })).toMatchObject({ ok: false, code: "STEP_UP_REQUIRED" });
    expect(m.email.createBroadcast).not.toHaveBeenCalled();
    m.guard.hasFreshStepUp.mockResolvedValue(true);
    expect(await createBroadcastAction({ ...content, requestKey: "short" })).toMatchObject({ ok: false });
    m.email.createBroadcast.mockResolvedValue(ok({ broadcastId: "b1", recipientCount: 31, duplicate: false }));
    expect(await createBroadcastAction({ ...content, requestKey: KEY })).toMatchObject({ ok: true, data: { recipientCount: 31 } });
    expect(m.email.createBroadcast).toHaveBeenCalledWith(expect.anything(), { ...content, requestKey: KEY });
  });

  it("a repeated request key answers 'already created' instead of a second broadcast", async () => {
    m.email.createBroadcast.mockResolvedValue(ok({ broadcastId: "b1", recipientCount: 31, duplicate: true }));
    expect(await createBroadcastAction({ ...content, requestKey: KEY })).toMatchObject({ ok: true, message: "Ta rozsyłka już została utworzona." });
  });

  it("passes use-case refusals (a broadcast already running) to the owner", async () => {
    m.email.createBroadcast.mockResolvedValue({ ok: false, error: { message: "Poprzednia rozsyłka jeszcze trwa." } });
    expect(await createBroadcastAction({ ...content, requestKey: KEY })).toMatchObject({ ok: false, message: "Poprzednia rozsyłka jeszcze trwa." });
  });

  it("cancels through the use case and validates the id", async () => {
    m.email.cancelBroadcast.mockResolvedValue(ok({ cancelled: true, skipped: 12 }));
    expect(await cancelBroadcastAction({ id: "b1" })).toMatchObject({ ok: true, message: expect.stringContaining("12") });
    expect(await cancelBroadcastAction({ id: "" })).toMatchObject({ ok: false });
  });
});
