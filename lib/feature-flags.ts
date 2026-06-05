export function canUseDemoFallbacks() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_FALLBACKS === "true";
}

export const flags = {
  get demoFallbacks() {
    return canUseDemoFallbacks();
  },
  multiCreator: process.env.ENABLE_MULTI_CREATOR === "true",
  mainCreatorSlug: process.env.MAIN_CREATOR_SLUG || "",
};
