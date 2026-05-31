export const flags = {
  /**
   * Hidden campaign/zrzutka page. Experimental.
   */
  campaignPage: process.env.ENABLE_CAMPAIGN_PAGE === "true",

  /**
   * Whether to allow INITIAL_VIDEOS fallback.
   * In production: Strictly opt-in via ENABLE_DEMO_FALLBACKS=true.
   * In development: Active by default unless ENABLE_DEMO_FALLBACKS=false.
   */
  demoFallbacks: process.env.NODE_ENV === "production"
    ? process.env.ENABLE_DEMO_FALLBACKS === "true"
    : process.env.ENABLE_DEMO_FALLBACKS !== "false",

  /**
   * Future multi-creator support.
   */
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
};
