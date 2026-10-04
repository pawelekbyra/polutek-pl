import type { VideoAccessTier } from "@/lib/access-tier";
import { AccessDecisionReason } from "./access-reason";

export type AccessDecisionDto = {
  hasAccess: boolean;
  requiredTier?: VideoAccessTier;
  reason?: AccessDecisionReason;
  /**
   * Id of the video the decision is about (set whenever the video was found), so a caller that was
   * given a slug loads exactly the row that was checked.
   */
  videoId?: string;
  /**
   * ISO time of a premiere that has not happened yet, for non-admin viewers. Playback must be
   * refused until then (CLAUDE.md "Premieres"); `hasAccess` still covers comments and reactions.
   */
  premiereAt?: string;
};
