/**
 * AppSetting key that holds the id of the platform's main channel (the one the home page shows).
 * Stage 8 replaced the `Creator.isPrimary` flag and the `MAIN_CREATOR_SLUG` variable with this setting
 * (CLAUDE.md 4.24). Written by the stage 8 backfill migration and by the panel; read only through
 * `MainChannelService` / `resolveMainChannel*`.
 */
export const MAIN_CHANNEL_SETTING_KEY = "main_channel_id";
