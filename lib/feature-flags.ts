export const flags = {
  /**
   * Hidden campaign/zrzutka page. Experimental.
   */
  campaignPage: process.env.ENABLE_CAMPAIGN_PAGE === "true",

  /**
   * Whether to allow INITIAL_VIDEOS fallback in production.
   */
  demoFallbacks:
    process.env.ENABLE_DEMO_FALLBACKS === "true" ||
    process.env.NODE_ENV !== "production",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
