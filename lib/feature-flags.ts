export function canUseDemoFallbacks() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_FALLBACKS === "true";
}

export const flags = {
  get demoFallbacks() {
    return canUseDemoFallbacks();
  },
  get mainCreatorSlug() {
      const slug = process.env.MAIN_CREATOR_SLUG;

      // Prerendering in Vercel runs with NODE_ENV=production but often without full ENV.
      // We must not crash during build time, only at runtime.
      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

      if (!slug && !isBuildTime) {
          throw new Error("CRITICAL CONFIGURATION ERROR: MAIN_CREATOR_SLUG environment variable is missing.");
      }
      return slug || null;
  }
};

if (process.env.ENABLE_MULTI_CREATOR === "true") {
  console.warn("WARNING: ENABLE_MULTI_CREATOR is deprecated and unsupported. Polutek.pl is strict single-channel.");
}
