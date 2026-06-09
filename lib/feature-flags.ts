import { MAIN_CREATOR_SLUG } from './constants';

export function canUseDemoFallbacks() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_FALLBACKS === "true";
}

export const flags = {
  get demoFallbacks() {
    return canUseDemoFallbacks();
  },
  get mainCreatorSlug() {
      const slug = process.env.MAIN_CREATOR_SLUG || MAIN_CREATOR_SLUG;
      if (!slug && process.env.NODE_ENV === "production") {
          throw new Error("CRITICAL CONFIGURATION ERROR: MAIN_CREATOR_SLUG is missing in production.");
      }
      return slug || null;
  }
};

if (process.env.ENABLE_MULTI_CREATOR === "true") {
  console.warn("WARNING: ENABLE_MULTI_CREATOR is deprecated and unsupported. Polutek.pl is strict single-channel.");
}
