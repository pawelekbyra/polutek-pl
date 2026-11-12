import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ctx: { actor: { type: "admin", userId: "adm-test" } },
  openGate: vi.fn(),
  resolveModerationAppeal: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@admin/lib/actions/gate", () => ({ openGate: m.openGate }));
vi.mock("@/lib/modules/channel", () => ({
  issueChannelStrike: vi.fn(),
  resolveContentReport: vi.fn(),
  resolveModerationAppeal: m.resolveModerationAppeal,
  revokeChannelStrike: vi.fn(),
  setChannelStatus: vi.fn(),
  setChannelTrustLevel: vi.fn(),
  setVideoModerationStatus: vi.fn(),
}));

import { resolveAppealAction } from "@admin/app/(panel)/kanaly/actions";
import { RATE } from "@admin/lib/actions/rate-limit";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";

function appealForm(values: Record<string, string> = {}) {
  const form = new FormData();
  form.set("appealId", values.appealId ?? "appeal-1");
  form.set("outcome", values.outcome ?? "UPHELD");
  form.set("reasonPublic", values.reasonPublic ?? " Uzasadnienie dla twórcy ");
  if (values.reasonInternal) form.set("reasonInternal", values.reasonInternal);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  m.openGate.mockResolvedValue({ ok: true, ctx: m.ctx });
  m.resolveModerationAppeal.mockResolvedValue({ ok: true, data: { outcomeDecisionId: "decision-outcome", reverted: true, note: "cofnięto" } });
});

describe("resolveAppealAction", () => {
  it("passes a validated and normalized decision through the admin gate", async () => {
    const result = await resolveAppealAction(null, appealForm({ reasonInternal: " wewnętrzne " }));

    expect(result).toMatchObject({ ok: true, message: expect.stringContaining("Odwołanie uwzględnione") });
    expect(m.openGate).toHaveBeenCalledWith({ path: "/kanaly", rate: RATE.security });
    expect(m.resolveModerationAppeal).toHaveBeenCalledWith(m.ctx, {
      appealId: "appeal-1", outcome: "UPHELD", reasonPublic: "Uzasadnienie dla twórcy", reasonInternal: "wewnętrzne",
    });
    expect(m.revalidatePath).toHaveBeenCalledWith("/kanaly");
  });

  it("does not reach the use case when the admin gate or input validation refuses", async () => {
    m.openGate.mockResolvedValueOnce({ ok: false, result: { ok: false, message: "Brak dostępu" } });
    expect(await resolveAppealAction(null, appealForm())).toMatchObject({ ok: false, message: "Brak dostępu" });
    m.openGate.mockResolvedValue({ ok: true, ctx: m.ctx });
    expect(await resolveAppealAction(null, appealForm({ outcome: "MAYBE" }))).toMatchObject({ ok: false, message: "Popraw zaznaczone pola." });
    expect(m.resolveModerationAppeal).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps stale appeal conflicts to a safe action response", async () => {
    m.resolveModerationAppeal.mockResolvedValueOnce({ ok: false, error: { code: "APPEAL_RESOLVED", message: "To odwołanie jest już rozpatrzone." } });
    expect(await resolveAppealAction(null, appealForm({ outcome: "REJECTED" }))).toMatchObject({ ok: false, code: "APPEAL_RESOLVED", message: "To odwołanie jest już rozpatrzone." });
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});
