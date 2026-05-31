export const flags = {
  /**
   * Hidden campaign/zrzutka page. Experimental.
   */
  campaignPage: process.env.ENABLE_CAMPAIGN_PAGE === "true",

  /**
   * Whether to allow INITIAL_VIDEOS fallback in production.
   * Default: true (unless explicitly disabled)
   */
  demoFallbacks: process.env.ENABLE_DEMO_FALLBACKS !== "false",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
