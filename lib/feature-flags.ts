export const flags = {
  /**
   * Hidden campaign/zrzutka page. Experimental.
   */
  campaignPage: process.env.ENABLE_CAMPAIGN_PAGE === "true",

  /**
   * Whether to allow INITIAL_VIDEOS fallback.
   * Opt-in required. Recommended only for development.
   */
  demoFallbacks:
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEMO_FALLBACKS === "true",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
