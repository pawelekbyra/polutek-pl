export const flags = {
  demoFallbacks: process.env.ENABLE_DEMO_FALLBACKS === "true",
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
  mainCreatorSlug: process.env.MAIN_CREATOR_SLUG || "",
};
