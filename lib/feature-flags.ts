export function canUseDemoFallbacks() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_FALLBACKS === "true";
}

export const flags = {
  get demoFallbacks() {
    return canUseDemoFallbacks();
  },
};

if (process.env.ENABLE_MULTI_CREATOR === "true") {
  console.warn("WARNING: ENABLE_MULTI_CREATOR is ignored. Channel creation is controlled by PLATFORM_GATE_CHANNEL_CREATION (lib/platform-gates.ts, CLAUDE.md 4.24).");
}
