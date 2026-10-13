export type AccessDecisionReason =
  | "LOGIN_REQUIRED"
  | "NOT_FOUND"
  | "DELETED"
  | "FORBIDDEN"
  /** Paid video and the viewer owns no entitlement for it (stage 6). */
  | "PAYMENT_REQUIRED";
