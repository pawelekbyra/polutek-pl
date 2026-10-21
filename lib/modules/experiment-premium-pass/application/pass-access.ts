// experiment: premium-pass (docs/experiments/premium-pass.md)
// What the access decision, the playback plan, the sidebar and the shelf ask about the pass.
import type { AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { isPremiumPassVideo, premiumPassFor, type PremiumPassConfig, type PremiumPassVideoFacts } from "../domain/config";
import { passStateOf, type PassState } from "../domain/pass-state";
import { buildPremiumPassOffer, type PremiumPassOffer } from "../domain/offer";
import { resolvePremiumPayments, toPremiumPaymentsDto } from "../domain/payments-mode";
import { readPass } from "../infrastructure/pass-store";

export type PremiumPassGate = { denied: true } | { activeUntil: string } | null;

export function passUserId(actor: Actor): string | null {
  return actor.type === "user" || actor.type === "admin" ? actor.userId : null;
}

/** The viewer's own patron-zone access state (guests: none). */
export async function viewerPassState(ctx: Pick<AppContext, "prisma" | "actor">, now: Date): Promise<PassState> {
  const userId = passUserId(ctx.actor);
  return userId ? passStateOf(await readPass(ctx.prisma, userId), now) : { state: "none" };
}

/**
 * The pass gate of `checkVideoAccess`. null = the experiment does not concern this viewer or video (the decision goes
 * on exactly as without it). Applies to ADMIN on the public site too (owner decision 2026-10-20).
 */
export async function premiumPassGate(ctx: Pick<AppContext, "prisma" | "actor">, video: PremiumPassVideoFacts, now: Date): Promise<PremiumPassGate> {
  const config = premiumPassFor(ctx.actor);
  if (!config || !isPremiumPassVideo(video, config, now)) return null;
  const state = await viewerPassState(ctx, now);
  return state.state === "active" ? { activeUntil: state.record.expiresAt } : { denied: true };
}

export type PremiumPassVideoRow = { id: string; slug: string; status: string; isMainFeatured: boolean; premiereAt: Date | null };

/** The live videos behind the pass, in the configured order. */
export async function listPremiumPassVideos(ctx: Pick<AppContext, "prisma">, config: PremiumPassConfig, now: Date): Promise<PremiumPassVideoRow[]> {
  if (config.slugs.size === 0) return [];
  const rows = await ctx.prisma.video.findMany({
    where: { slug: { in: [...config.slugs] } },
    select: { id: true, slug: true, status: true, isMainFeatured: true, premiereAt: true },
  });
  const order = [...config.slugs];
  return rows
    .filter((row) => isPremiumPassVideo(row, config, now))
    .sort((a, b) => order.indexOf(a.slug.toLowerCase()) - order.indexOf(b.slug.toLowerCase()));
}

/** The offer a PASS_REQUIRED plan carries, for this viewer (expired banner from the viewer's own pass). */
export async function premiumPassOfferFor(ctx: Pick<AppContext, "prisma" | "actor">, now: Date): Promise<PremiumPassOffer | null> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return null;
  const [videos, state] = await Promise.all([listPremiumPassVideos(ctx, config, now), viewerPassState(ctx, now)]);
  return buildPremiumPassOffer({
    signedIn: passUserId(ctx.actor) !== null,
    premiumCount: videos.length,
    expiredAt: state.state === "expired" ? state.record.expiresAt : null,
    payments: toPremiumPaymentsDto(resolvePremiumPayments()),
  });
}

/**
 * Sidebar and shelf: which of these videos are behind the pass for this viewer, and whether the viewer holds an
 * active pass. null when the experiment is invisible to the viewer.
 */
export async function premiumPassViewerFacts(ctx: Pick<AppContext, "prisma" | "actor">, now: Date): Promise<{ isPremium: (video: PremiumPassVideoFacts) => boolean; hasActivePass: boolean } | null> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return null;
  const state = await viewerPassState(ctx, now);
  return { isPremium: (video) => isPremiumPassVideo(video, config, now), hasActivePass: state.state === "active" };
}

/** Ids of shelf videos the viewer cannot open now because they are behind the pass (like paid videos). */
export async function premiumPassLockedIds(ctx: Pick<AppContext, "prisma" | "actor">, videos: Array<PremiumPassVideoFacts & { id: string }>, now: Date): Promise<Set<string>> {
  const facts = await premiumPassViewerFacts(ctx, now);
  if (!facts || facts.hasActivePass) return new Set();
  return new Set(videos.filter((video) => facts.isPremium(video)).map((video) => video.id));
}
