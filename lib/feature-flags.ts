export const flags = {
  /**
   * Hidden campaign/zrzutka page. Experimental.
   */
  campaignPage: process.env.ENABLE_CAMPAIGN_PAGE === "true",

  /**
   * Whether to allow INITIAL_VIDEOS fallback.
   * Default: true (recommended only for dev/demo).
   * Disable in production by setting ENABLE_DEMO_FALLBACKS=false.
   */
  demoFallbacks: process.env.ENABLE_DEMO_FALLBACKS !== "false",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
