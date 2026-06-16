import { AuthError } from "@/lib/auth-utils";
import { isPrismaErrorCode } from "@/lib/utils/db";

export function classifyAdminChannelError(err: unknown) {
  if (err instanceof AuthError) {
    return {
      code: "FORBIDDEN",
      title: "Forbidden",
      message: "You do not have access to channel settings.",
      showMaintenanceNote: false,
    };
  }

  // Safe extraction for non-Prisma business errors
  const name = (err && typeof err === 'object' && 'name' in err) ? (err as { name: unknown }).name : undefined;
  const code = (err && typeof err === 'object' && 'code' in err) ? (err as { code: unknown }).code : undefined;

  if (
    name === "MainChannelNotFoundError" ||
    code === "CHANNEL_NOT_FOUND"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_FOUND",
      title: "Main Channel Missing",
      message: "The primary channel record was not found in the database. Please check your configuration and initialization status.",
      showMaintenanceNote: true,
    };
  }
  if (
    name === "MainChannelNotApprovedError" ||
    code === "CHANNEL_NOT_APPROVED"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_APPROVED",
      title: "Channel Not Approved",
      message: "The main channel is currently not approved. Public access and admin settings are restricted.",
      showMaintenanceNote: true,
    };
  }
  if (
    name === "MainChannelNotPrimaryError" ||
    code === "CHANNEL_NOT_PRIMARY"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_PRIMARY",
      title: "Channel Not Primary",
      message: "This channel is not marked as the primary channel. Admin settings can only be accessed for the primary channel.",
      showMaintenanceNote: true,
    };
  }

  if (isPrismaErrorCode(err, "P2021") || isPrismaErrorCode(err, "P2022")) {
    return {
      code: "DB_SCHEMA_MISMATCH",
      title: "Database Schema Mismatch",
      message:
        "Database schema is out of date or missing tables/columns. Please run 'npm run db:migrate:deploy'.",
      showMaintenanceNote: true,
    };
  }

  if (
    isPrismaErrorCode(err, "P1001") ||
    isPrismaErrorCode(err, "P1003") ||
    isPrismaErrorCode(err, "P1008") ||
    name === "PrismaClientInitializationError"
  ) {
    return {
      code: "DB_CONNECTION_ERROR",
      title: "Database Connection Error",
      message: "Could not reach the database server. Please check your connection settings.",
      showMaintenanceNote: false,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    title: "Internal Error",
    message:
      "Channel settings could not be loaded. Please check logs before changing channel data.",
    showMaintenanceNote: false,
  };
}
