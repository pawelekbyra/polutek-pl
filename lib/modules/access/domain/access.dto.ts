import { AccessTier } from "@prisma/client";

export type AccessDecisionReason =
  | "LOGIN_REQUIRED"
  | "PATRON_REQUIRED"
  | "ADMIN_REQUIRED"
  | "NOT_FOUND"
  | "DELETED"
  | "FORBIDDEN";

export type AccessDecisionDto = {
  hasAccess: boolean;
  requiredTier?: AccessTier;
  reason?: AccessDecisionReason;
};
