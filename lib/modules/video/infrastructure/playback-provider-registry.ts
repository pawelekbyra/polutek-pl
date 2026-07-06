import { StorageProvider } from "@prisma/client";
import { isAutomaticFilePlaybackProvider } from "../domain/video-provider-capabilities";
import { CloudflareStreamProviderAdapter } from "./cloudflare-stream.provider";
import { MuxProviderAdapter } from "./mux.provider";
import { PlaybackProviderAdapter } from "./playback-provider-adapter";

export class PlaybackProviderRegistry {
  constructor(private readonly adapters: PlaybackProviderAdapter[]) {}

  get(provider: StorageProvider): PlaybackProviderAdapter {
    const adapter = this.adapters.find((candidate) => candidate.provider === provider);
    if (!adapter) throw new Error(`No playback provider adapter registered for ${provider}`);
    return adapter;
  }

  listConfiguredAutomaticProviders(): StorageProvider[] {
    return this.adapters
      .filter((adapter) => adapter.isConfigured() && isAutomaticFilePlaybackProvider(adapter.provider))
      .map((adapter) => adapter.provider);
  }
}

export function createDefaultPlaybackProviderRegistry(): PlaybackProviderRegistry {
  return new PlaybackProviderRegistry([
    new CloudflareStreamProviderAdapter(),
    new MuxProviderAdapter(),
  ]);
}
