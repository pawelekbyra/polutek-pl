export const flags = {
  /**
   * Whether to allow INITIAL_VIDEOS fallback.
   * Opt-in only: production must never enable demo data by omission.
   */
  demoFallbacks: process.env.ENABLE_DEMO_FALLBACKS === "true",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
