import { AccessTier } from "@prisma/client";
import { AccessDecisionReason } from "./access-reason";

export type AccessDecisionDto = {
  hasAccess: boolean;
  requiredTier?: AccessTier;
  reason?: AccessDecisionReason;
};
