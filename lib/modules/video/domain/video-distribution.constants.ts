import { StorageProvider } from "@prisma/client";
import { isPlaybackProvider } from "./video-provider-capabilities";
import type { VideoDistributionStrategyInput } from "./video-distribution.types";

// Cloudflare Stream is the current product default for Polutek.pl. It is not
// an architectural default: distribution logic must remain provider-neutral.
export const DEFAULT_DISTRIBUTION_STRATEGY = {
  mode: "SINGLE_PROVIDER",
  provider: "CLOUDFLARE_STREAM",
  autopublishPolicy: "WHEN_ACTIVE_ROUTE_READY",
} satisfies VideoDistributionStrategyInput;

const DEFAULT_PROVIDER_COST_ORDER = [StorageProvider.CLOUDFLARE_STREAM, StorageProvider.MUX];

export function getProviderCostOrder(): StorageProvider[] {
  const raw = process.env.VIDEO_PROVIDER_COST_ORDER;
  const configured = raw
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (Object.values(StorageProvider) as string[]).includes(value) ? (value as StorageProvider) : null)
    .filter((provider): provider is StorageProvider => Boolean(provider && isPlaybackProvider(provider)));

  return configured && configured.length > 0 ? configured : DEFAULT_PROVIDER_COST_ORDER;
}
