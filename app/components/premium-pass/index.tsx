"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): what PremiumWrapper mounts for the demo pass.
import React from "react";
import { readPremiumPassOffer, type PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { PremiumPlayerChip } from "./PremiumBadge";
import { DemoControls } from "./DemoControls";

export { PremiumPassOverlay } from "./PremiumPassOverlay";

export type PassView = { offer: PremiumPassOffer; poster: string | null; title: string | null };

/** The offer part of a PASS_REQUIRED plan (defensive parse, like every plan field), or null. */
export function readPassView(plan: unknown): PassView | null {
  const data = plan as { access?: { offer?: unknown }; player?: { poster?: unknown; title?: unknown } } | null;
  const offer = readPremiumPassOffer(data?.access?.offer);
  if (!offer) return null;
  const poster = typeof data?.player?.poster === "string" && data.player.poster ? data.player.poster : null;
  const title = typeof data?.player?.title === "string" && data.player.title ? data.player.title : null;
  return { offer, poster, title };
}

/** Over a playing pass video: the "valid until" chip and the demo panel (expire / delete my pass). */
export function PremiumPassPlaying({ until, onRefresh }: { until?: string; onRefresh: () => void }) {
  if (!until) return null;
  return (
    <>
      <PremiumPlayerChip until={until} />
      <DemoControls onChanged={onRefresh} />
    </>
  );
}
