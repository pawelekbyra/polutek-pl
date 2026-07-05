import { StorageProvider } from "@prisma/client";

export type AutomaticFilePlaybackProvider = "CLOUDFLARE_STREAM" | "MUX";

export type VideoDistributionStrategyInput =
  | {
      mode: "SINGLE_PROVIDER";
      provider: AutomaticFilePlaybackProvider;
      autopublishPolicy?: "NEVER" | "WHEN_ACTIVE_ROUTE_READY" | "WHEN_ANY_TARGET_READY";
    }
  | {
      mode: "MULTI_PROVIDER";
      providers: AutomaticFilePlaybackProvider[];
      preferredProvider?: AutomaticFilePlaybackProvider;
      selectionPolicy?: "FIRST_READY" | "PREFER_SELECTED" | "MANUAL";
      autopublishPolicy?:
        | "NEVER"
        | "WHEN_ANY_TARGET_READY"
        | "WHEN_ALL_REQUIRED_TARGETS_READY"
        | "WHEN_ACTIVE_ROUTE_READY";
    }
  | {
      mode: "AUTO";
      allowedProviders: AutomaticFilePlaybackProvider[];
      selectionPolicy?: "BEST_HEALTH" | "LOWEST_COST" | "FIRST_READY";
      autopublishPolicy?: "NEVER" | "WHEN_ANY_TARGET_READY";
    }
  | {
      mode: "MANUAL";
      autopublishPolicy?: "NEVER";
    };

export type NormalizedVideoDistributionStrategy = {
  mode: "SINGLE_PROVIDER" | "MULTI_PROVIDER" | "AUTO" | "MANUAL";
  providers: StorageProvider[];
  preferredProvider: StorageProvider | null;
  selectionPolicy: "MANUAL" | "FIRST_READY" | "PREFER_SELECTED" | "BEST_HEALTH" | "LOWEST_COST";
  autopublishPolicy:
    | "NEVER"
    | "WHEN_ANY_TARGET_READY"
    | "WHEN_ALL_REQUIRED_TARGETS_READY"
    | "WHEN_ACTIVE_ROUTE_READY";
};

const AUTOMATIC_FILE_PROVIDERS = new Set<string>([
  StorageProvider.CLOUDFLARE_STREAM,
  StorageProvider.MUX,
]);

function toStorageProvider(provider: AutomaticFilePlaybackProvider): StorageProvider {
  return provider === "MUX" ? StorageProvider.MUX : StorageProvider.CLOUDFLARE_STREAM;
}

function toAutomaticFilePlaybackProvider(value: string | null | undefined): AutomaticFilePlaybackProvider | null {
  if (!value) return null;
  if (!AUTOMATIC_FILE_PROVIDERS.has(value)) return null;
  return value as AutomaticFilePlaybackProvider;
}

function uniqueProviders(providers: AutomaticFilePlaybackProvider[]): StorageProvider[] {
  return Array.from(new Set(providers)).map(toStorageProvider);
}

export function normalizeVideoDistributionStrategy(
  input: VideoDistributionStrategyInput,
): NormalizedVideoDistributionStrategy {
  if (input.mode === "SINGLE_PROVIDER") {
    const provider = toStorageProvider(input.provider);
    return {
      mode: "SINGLE_PROVIDER",
      providers: [provider],
      preferredProvider: provider,
      selectionPolicy: "PREFER_SELECTED",
      autopublishPolicy: input.autopublishPolicy ?? "WHEN_ACTIVE_ROUTE_READY",
    };
  }

  if (input.mode === "MULTI_PROVIDER") {
    const providers = uniqueProviders(input.providers);
    const preferredProvider = input.preferredProvider ? toStorageProvider(input.preferredProvider) : null;
    return {
      mode: "MULTI_PROVIDER",
      providers,
      preferredProvider: preferredProvider && providers.includes(preferredProvider) ? preferredProvider : null,
      selectionPolicy: input.selectionPolicy ?? "PREFER_SELECTED",
      autopublishPolicy: input.autopublishPolicy ?? "WHEN_ANY_TARGET_READY",
    };
  }

  if (input.mode === "AUTO") {
    const providers = uniqueProviders(input.allowedProviders);
    return {
      mode: "AUTO",
      providers,
      preferredProvider: null,
      selectionPolicy: input.selectionPolicy ?? "BEST_HEALTH",
      autopublishPolicy: input.autopublishPolicy ?? "WHEN_ANY_TARGET_READY",
    };
  }

  return {
    mode: "MANUAL",
    providers: [],
    preferredProvider: null,
    selectionPolicy: "MANUAL",
    autopublishPolicy: "NEVER",
  };
}

export function normalizeLegacyMirrorPlan(input: {
  mirrorPlan?: { mux?: boolean; cloudflare?: boolean };
  preferredProvider?: string | null;
  publishAfterReady?: boolean;
}): VideoDistributionStrategyInput {
  const selected: AutomaticFilePlaybackProvider[] = [];
  if (input.mirrorPlan?.cloudflare) selected.push("CLOUDFLARE_STREAM");
  if (input.mirrorPlan?.mux) selected.push("MUX");

  const autopublishPolicy = input.publishAfterReady ? "WHEN_ACTIVE_ROUTE_READY" : "NEVER";

  if (selected.length === 0) {
    return { mode: "MANUAL", autopublishPolicy: "NEVER" };
  }

  if (selected.length === 1) {
    return {
      mode: "SINGLE_PROVIDER",
      provider: selected[0],
      autopublishPolicy,
    };
  }

  const preferredProvider = toAutomaticFilePlaybackProvider(input.preferredProvider);
  return {
    mode: "MULTI_PROVIDER",
    providers: selected,
    ...(preferredProvider && selected.includes(preferredProvider) ? { preferredProvider } : {}),
    selectionPolicy: preferredProvider && selected.includes(preferredProvider) ? "PREFER_SELECTED" : "FIRST_READY",
    autopublishPolicy: input.publishAfterReady ? "WHEN_ANY_TARGET_READY" : "NEVER",
  };
}
