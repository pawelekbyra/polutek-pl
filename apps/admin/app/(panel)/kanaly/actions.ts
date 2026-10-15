"use server";
/**
 * Writes of "Kanały": channel status, strikes, trust level, report decisions. Gate (session, rate limit, step-up for
 * suspension and ban) -> zod .strict -> use case (authorization, decision row and audit live there) -> revalidate.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { issueChannelStrike, resolveContentReport, resolveModerationAppeal, revokeChannelStrike, setChannelStatus, setChannelTrustLevel, setVideoModerationStatus } from "@/lib/modules/channel";
import { openGate } from "@admin/lib/actions/gate";
import { RATE } from "@admin/lib/actions/rate-limit";
import { errorMessage, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const bad = (issues: { path: (string | number)[]; message: string }[]): ActionResult => ({ ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(issues) });

const statusSchema = z
  .object({
    channelId: z.string().min(1).max(100),
    status: z.enum(["ACTIVE", "LIMITED", "SUSPENDED", "BANNED"]),
    reason: z.string().trim().min(5, "Podaj powód (co najmniej 5 znaków).").max(500, "Najwyżej 500 znaków."),
    reasonPublic: z.string().trim().max(500).optional(),
  })
  .strict();

export async function setChannelStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const heavy = ["SUSPENDED", "BANNED"].includes(text(fd, "status"));
  const gate = await openGate({ path: "/kanaly", rate: RATE.security, stepUp: heavy });
  if (!gate.ok) return gate.result;
  const parsed = statusSchema.safeParse({ channelId: text(fd, "channelId"), status: text(fd, "status"), reason: text(fd, "reason"), reasonPublic: text(fd, "reasonPublic") || undefined });
  if (!parsed.success) return bad(parsed.error.issues);
  const res = await setChannelStatus(gate.ctx, parsed.data);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/kanaly");
  revalidatePath(`/kanaly/${parsed.data.channelId}`);
  return { ok: true, message: "Status kanału zmieniony." };
}

const strikeSchema = z
  .object({
    channelId: z.string().min(1).max(100),
    policy: z.string().trim().min(2, "Podaj zasadę.").max(80),
    reason: z.string().trim().min(5, "Podaj powód (co najmniej 5 znaków).").max(500),
    expiresInDays: z.coerce.number().int().min(1).max(365),
  })
  .strict();

export async function issueStrikeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/kanaly", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const parsed = strikeSchema.safeParse({ channelId: text(fd, "channelId"), policy: text(fd, "policy"), reason: text(fd, "reason"), expiresInDays: text(fd, "expiresInDays") || "90" });
  if (!parsed.success) return bad(parsed.error.issues);
  const res = await issueChannelStrike(gate.ctx, parsed.data);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath(`/kanaly/${parsed.data.channelId}`);
  return { ok: true, message: "Ostrzeżenie nałożone." };
}

const revokeSchema = z.object({ channelId: z.string().min(1).max(100), strikeId: z.string().min(1).max(100), reason: z.string().trim().min(5, "Podaj powód (co najmniej 5 znaków).").max(500) }).strict();

export async function revokeStrikeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/kanaly", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const parsed = revokeSchema.safeParse({ channelId: text(fd, "channelId"), strikeId: text(fd, "strikeId"), reason: text(fd, "reason") });
  if (!parsed.success) return bad(parsed.error.issues);
  const res = await revokeChannelStrike(gate.ctx, { strikeId: parsed.data.strikeId, reason: parsed.data.reason });
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath(`/kanaly/${parsed.data.channelId}`);
  return { ok: true, message: "Ostrzeżenie cofnięte." };
}

const trustSchema = z.object({ channelId: z.string().min(1).max(100), trustLevel: z.coerce.number().int().min(0).max(2) }).strict();

export async function setTrustLevelAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/kanaly", rate: RATE.settings });
  if (!gate.ok) return gate.result;
  const parsed = trustSchema.safeParse({ channelId: text(fd, "channelId"), trustLevel: text(fd, "trustLevel") });
  if (!parsed.success) return bad(parsed.error.issues);
  const res = await setChannelTrustLevel(gate.ctx, parsed.data);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath(`/kanaly/${parsed.data.channelId}`);
  return { ok: true, message: "Poziom zaufania zmieniony. Limity wgrywania są nowe." };
}

const reportSchema = z
  .object({
    reportId: z.string().min(1).max(100),
    outcome: z.enum(["DISMISSED", "ACTION_TAKEN"]),
    reasonPublic: z.string().trim().min(3, "Podaj uzasadnienie (co najmniej 3 znaki).").max(500),
    reasonInternal: z.string().trim().max(500).optional(),
    removeVideo: z.boolean(),
  })
  .strict();

export async function resolveReportAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/kanaly", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const parsed = reportSchema.safeParse({
    reportId: text(fd, "reportId"),
    outcome: text(fd, "outcome"),
    reasonPublic: text(fd, "reasonPublic"),
    reasonInternal: text(fd, "reasonInternal") || undefined,
    removeVideo: text(fd, "removeVideo") === "on",
  });
  if (!parsed.success) return bad(parsed.error.issues);
  const res = await resolveContentReport(gate.ctx, parsed.data);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/kanaly");
  return { ok: true, message: "Zgłoszenie rozstrzygnięte." };
}

const videoModerationSchema = z
  .object({
    channelId: z.string().min(1).max(100),
    videoId: z.string().min(1).max(100),
    status: z.enum(["VISIBLE", "LIMITED", "AGE_RESTRICTED", "REMOVED"]),
    reason: z.string().trim().min(5, "Podaj powód (co najmniej 5 znaków).").max(500),
  })
  .strict();

export async function setVideoModerationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/kanaly", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const parsed = videoModerationSchema.safeParse({ channelId: text(fd, "channelId"), videoId: text(fd, "videoId"), status: text(fd, "status"), reason: text(fd, "reason") });
  if (!parsed.success) return bad(parsed.error.issues);
  const { channelId, ...rest } = parsed.data;
  const res = await setVideoModerationStatus(gate.ctx, rest);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath(`/kanaly/${channelId}`);
  return { ok: true, message: "Status filmu zmieniony." };
}

const appealSchema = z
  .object({
    appealId: z.string().min(1).max(100),
    outcome: z.enum(["UPHELD", "REJECTED"]),
    reasonPublic: z.string().trim().min(3, "Podaj uzasadnienie dla twórcy (co najmniej 3 znaki).").max(500, "Najwyżej 500 znaków."),
    reasonInternal: z.string().trim().max(500).optional(),
  })
  .strict();

/** "Uwzględnij" reverses the effect of the decision; "Oddal" only records the reasons. Both write a new decision. */
export async function resolveAppealAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const gate = await openGate({ path: "/kanaly", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const parsed = appealSchema.safeParse({
    appealId: text(fd, "appealId"),
    outcome: text(fd, "outcome"),
    reasonPublic: text(fd, "reasonPublic"),
    reasonInternal: text(fd, "reasonInternal") || undefined,
  });
  if (!parsed.success) return bad(parsed.error.issues);
  const res = await resolveModerationAppeal(gate.ctx, parsed.data);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/kanaly");
  return { ok: true, message: parsed.data.outcome === "UPHELD" ? `Odwołanie uwzględnione. ${res.data.note}` : "Odwołanie oddalone. Twórca dostał uzasadnienie." };
}
