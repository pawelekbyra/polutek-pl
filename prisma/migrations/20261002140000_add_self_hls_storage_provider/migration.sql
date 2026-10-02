-- Own HLS delivery (self-hosted pilot): new playback provider value. Additive.
ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'SELF_HLS';
