export const flags = {
  /**
   * Hidden campaign/zrzutka page. Experimental.
   */
  campaignPage: process.env.ENABLE_CAMPAIGN_PAGE === "true",

  /**
   * Whether to allow INITIAL_VIDEOS fallback.
   * Strictly opt-in and NOT allowed in production.
   */
  demoFallbacks:
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEMO_FALLBACKS === "true",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
