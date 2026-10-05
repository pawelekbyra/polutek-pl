import { describe, expect, it, vi } from "vitest";
import { buildMorningReport, histFromValues, morningReportConfig, runMorningReport } from "@/lib/modules/admin-analytics";
import { tokenAuthorised } from "@admin/lib/jobs-auth";
import { deps, fakeApp, fakeTelemetry, playbackDay, VIDEO_A } from "./fakes";

// NOW is Monday 5 Oct 2026, 12:00 Warsaw: the report covers Sunday 4 Oct.
const telemetry = () =>
  fakeTelemetry({
    trafficDaily: [
      { day: "2026-10-04", pageviews: 120, visitors: 50 },
      { day: "2026-10-03", pageviews: 100, visitors: 40 },
      { day: "2026-09-27", pageviews: 60, visitors: 25 },
    ],
    playbackDaily: [playbackDay("2026-10-04", { attempts: 10, started: 9, views: 8, startupN: 9, startupHist: histFromValues([500, 600, 700, 800, 900, 1000, 1100, 1200, 1300]), errors: 1 })],
    videoTotals: [{ videoId: "va", attempts: 10, started: 9, views: 8, watchMs: 1, retentionSum: 1 }],
    deploys: [{ at: new Date("2026-10-04T08:00:00Z"), job: "deploy", detail: "x" }],
  });
const app = () => fakeApp({ videos: [VIDEO_A], accounts: [new Date("2026-10-04T10:00:00Z")], payments: [] });

describe("morning report", () => {
  it("is disabled by default and never touches the mail transport", async () => {
    const mailer = vi.fn();
    expect(morningReportConfig({}).enabled).toBe(false);
    expect(await runMorningReport(deps(telemetry(), app()), { env: {}, mailer })).toMatchObject({ status: "disabled" });
    expect(await runMorningReport(deps(telemetry(), app()), { env: { ADMIN_MORNING_REPORT: "off", ADMIN_MORNING_REPORT_TO: "a@b.pl" }, mailer })).toMatchObject({ status: "disabled" });
    expect(await runMorningReport(deps(telemetry(), app()), { env: { ADMIN_MORNING_REPORT: "on" }, mailer })).toMatchObject({ status: "disabled" });
    expect(await runMorningReport(deps(telemetry(), app()), { env: { ADMIN_MORNING_REPORT: "on", ADMIN_MORNING_REPORT_TO: "not-an-address" }, mailer })).toMatchObject({ status: "disabled" });
    expect(mailer).not.toHaveBeenCalled();
  });

  it("sends once with an idempotency key per day when explicitly enabled (mocked transport)", async () => {
    const mailer = vi.fn(async () => ({ ok: true }));
    const r = await runMorningReport(deps(telemetry(), app()), { env: { ADMIN_MORNING_REPORT: "on", ADMIN_MORNING_REPORT_TO: "owner@example.com" }, mailer });
    expect(r.status).toBe("sent");
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(mailer.mock.calls[0][0]).toMatchObject({ to: "owner@example.com", idempotencyKey: "morning-report-2026-10-04" });
    expect(mailer.mock.calls[0][0].subject).toContain("Poranny raport");
  });

  it("reports a transport failure instead of claiming success", async () => {
    const r = await runMorningReport(deps(telemetry(), app()), { env: { ADMIN_MORNING_REPORT: "on", ADMIN_MORNING_REPORT_TO: "owner@example.com" }, mailer: async () => ({ ok: false, error: "429" }) });
    expect(r).toEqual({ status: "failed", error: "429" });
  });

  it("preview builds the content without sending, even when enabled", async () => {
    const mailer = vi.fn();
    const r = await runMorningReport(deps(telemetry(), app()), { env: { ADMIN_MORNING_REPORT: "on", ADMIN_MORNING_REPORT_TO: "owner@example.com" }, mailer, preview: true });
    expect(r.status).toBe("preview");
    expect(mailer).not.toHaveBeenCalled();
  });

  it("compares with the day before and the same weekday last week, and marks missing numbers", async () => {
    const rep = await buildMorningReport(deps(telemetry(), app()));
    expect(rep.day).toBe("2026-10-04");
    expect(rep.text).toContain("Odwiedzający: 50");
    expect(rep.text).toContain("vs poprzednia doba: +25%");
    expect(rep.text).toContain("vs tydzień temu: +100%");
    expect(rep.text).toContain("Nowe konta: 1");
    expect(rep.text).toContain("Wdrożenia: 1");
    expect(rep.text).toContain("Cześć: 9 startów");
    expect(rep.text).toContain("Mała próba: n = 9");
    const empty = await buildMorningReport(deps(null, fakeApp()));
    expect(empty.text).toContain("Odwiedzający: bez pomiaru");
    expect(empty.text).toContain("Czas startu p95: bez pomiaru");
    expect(empty.text).not.toMatch(/Odwiedzający: 0/);
  });

  it("escapes HTML in titles", async () => {
    const t = fakeTelemetry({ videoTotals: [{ videoId: "va", attempts: 1, started: 1, views: 0, watchMs: 0, retentionSum: 0 }] });
    const rep = await buildMorningReport(deps(t, fakeApp({ videos: [{ ...VIDEO_A, title: "<script>x</script>" }] })));
    expect(rep.html).not.toContain("<script>");
    expect(rep.html).toContain("&lt;script&gt;");
  });
});

describe("scheduler token", () => {
  const token = "x".repeat(40);
  it("accepts only an exact bearer token of at least 32 characters", () => {
    expect(tokenAuthorised(`Bearer ${token}`, token)).toBe(true);
    expect(tokenAuthorised(`Bearer ${token}y`, token)).toBe(false);
    expect(tokenAuthorised(token, token)).toBe(false);
    expect(tokenAuthorised(null, token)).toBe(false);
    expect(tokenAuthorised("Bearer short", "short")).toBe(false);
    expect(tokenAuthorised(`Bearer ${token}`, undefined)).toBe(false);
  });
});
