export type Actor =
  | { type: "guest" }
  /**
   * `onboardingPending`: the account has not picked a nickname yet (its name is a placeholder), so it
   * may not write anything shown under its name (comments, reactions). Set only when true.
   */
  | { type: "user"; userId: string; onboardingPending?: true }
  | { type: "admin"; userId: string }
  | { type: "system"; reason: string };
