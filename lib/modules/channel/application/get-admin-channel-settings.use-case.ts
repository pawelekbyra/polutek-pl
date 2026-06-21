import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/modules/shared/app-error";

export type AdminChannelSettingsDto = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  bannerUrl: string | null;
  subscribersCount: number;
  displaySubscribersCount: number | null;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    imageUrl: string | null;
  } | null;
};

export type AdminChannelDiagnosticsDto = {
  configuredSlug: string | null;
  mainChannelLookup: "FOUND" | "MISSING" | "INVALID";
  mainChannelId: string | null;
  isApproved: boolean | null;
  isPrimary: boolean | null;
  settingsRecord: "FOUND" | "MISSING";
};

export type AdminChannelSettingsResultDto = {
  creator: AdminChannelSettingsDto;
  diagnostics: AdminChannelDiagnosticsDto;
};

export function getSafeAdminChannelDiagnostics(error: unknown): {
  code:
    | "MAIN_CHANNEL_NOT_FOUND"
    | "MAIN_CHANNEL_NOT_APPROVED"
    | "MAIN_CHANNEL_NOT_PRIMARY"
    | "CHANNEL_SCHEMA_MISMATCH"
    | "CHANNEL_DATABASE_ERROR"
    | "CHANNEL_INTERNAL_ERROR";
  message: string;
} {
  const err = error as { name?: string; code?: string };

  if (err.name === "MainChannelNotFoundError" || err.code === "CHANNEL_NOT_FOUND") {
    return {
      code: "MAIN_CHANNEL_NOT_FOUND",
      message: "Main channel configuration is missing.",
    };
  }

  if (err.name === "MainChannelNotApprovedError" || err.code === "CHANNEL_NOT_APPROVED") {
    return {
      code: "MAIN_CHANNEL_NOT_APPROVED",
      message: "Main channel exists but is not approved.",
    };
  }

  if (err.name === "MainChannelNotPrimaryError" || err.code === "CHANNEL_NOT_PRIMARY") {
    return {
      code: "MAIN_CHANNEL_NOT_PRIMARY",
      message: "Main channel exists but is not marked as primary.",
    };
  }

  if (err.code === "CHANNEL_SETTINGS_RECORD_MISSING" || err.code === "P2022" || err.code === "P2021") {
    return {
      code: "CHANNEL_SCHEMA_MISMATCH",
      message: "Channel settings could not be read because the database shape does not match the application contract.",
    };
  }

  if (typeof err.code === "string" && /^P10\d\d$/.test(err.code)) {
    return {
      code: "CHANNEL_DATABASE_ERROR",
      message: "Channel settings could not be read because the database connection failed.",
    };
  }

  return {
    code: "CHANNEL_INTERNAL_ERROR",
    message: "Channel settings could not be loaded. Please check server logs.",
  };
}

export async function getAdminChannelSettings(ctx: AppContext): Promise<AdminChannelSettingsDto> {
  if (ctx.actor.type !== 'admin') {
    throw new AppError("Only admins can access channel settings", 403, "FORBIDDEN");
  }

  const db = ctx.prisma as PrismaClient;
  const mainChannel = await MainChannelService.getRequired(ctx);

  const creator = await db.creator.findUnique({
    where: { id: mainChannel.id },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      bannerUrl: true,
      subscribersCount: true,
      displaySubscribersCount: true,
      user: { select: { id: true, email: true, name: true, imageUrl: true } },
    },
  });

  if (!creator) {
    throw new AppError(
      "Main channel settings record is missing after lookup.",
      500,
      "CHANNEL_SETTINGS_RECORD_MISSING",
    );
  }

  return creator;
}

export async function getAdminChannelSettingsWithDiagnostics(
  ctx: AppContext,
): Promise<AdminChannelSettingsResultDto> {
  const creator = await getAdminChannelSettings(ctx);

  return {
    creator,
    diagnostics: {
      configuredSlug: MainChannelService.getConfiguredSlug() || null,
      mainChannelLookup: "FOUND",
      mainChannelId: creator.id,
      isApproved: true,
      isPrimary: true,
      settingsRecord: "FOUND",
    },
  };
}
