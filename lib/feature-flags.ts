import { MAIN_CREATOR_SLUG } from './constants';

export function canUseDemoFallbacks() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_FALLBACKS === "true";
}

export const flags = {
  get demoFallbacks() {
    return canUseDemoFallbacks();
  },
  /** @deprecated Polutek is now strict single-channel. Multi-creator mode is unsupported and disabled in runtime. */
  multiCreator: false,
  mainCreatorSlug: process.env.MAIN_CREATOR_SLUG || MAIN_CREATOR_SLUG,
};

if (process.env.ENABLE_MULTI_CREATOR === "true") {
  console.warn("WARNING: ENABLE_MULTI_CREATOR is deprecated and unsupported. Polutek.pl is strict single-channel.");
}
