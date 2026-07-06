import type { AdminVideoMediaDto } from "@/lib/modules/video/application/video-media-state.dto";
import type { VideoDistributionStrategyInput } from "@/lib/modules/video";

export type VideoMediaState = AdminVideoMediaDto;
export type VideoDistributionStrategy = VideoDistributionStrategyInput;
export type StrategyChoice = "AUTO" | "CLOUDFLARE_STREAM" | "MUX" | "CLOUDFLARE_MUX" | "MANUAL";
