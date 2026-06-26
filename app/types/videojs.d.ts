declare module "video.js" {
  export type VideoJsPlayer = {
    ready(callback: () => void): void;
    on(event: string, callback: () => void): void;
    currentTime(): number | undefined;
    duration(): number | undefined;
    error(): { code?: number } | null;
    dispose(): void;
  };

  export type VideoJsOptions = {
    autoplay?: boolean;
    controls?: boolean;
    fluid?: boolean;
    responsive?: boolean;
    fill?: boolean;
    muted?: boolean;
    playsinline?: boolean;
    preload?: string;
    poster?: string;
    sources?: Array<{ src: string; type?: string }>;
    html5?: {
      vhs?: {
        overrideNative?: boolean;
      };
    };
  };

  export default function videojs(
    element: HTMLVideoElement,
    options?: VideoJsOptions,
  ): VideoJsPlayer;
}

declare module "video.js/dist/types/player" {
  import type { VideoJsPlayer } from "video.js";
  export default VideoJsPlayer;
}
