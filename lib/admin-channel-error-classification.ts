import { AuthError } from "@/lib/auth-utils";

export function classifyAdminChannelError(err: unknown) {
  if (err instanceof AuthError) {
    return {
      code: "FORBIDDEN",
      title: "Forbidden",
      message: "You do not have access to channel settings.",
      showMaintenanceNote: false,
    };
  }

  const error = err as { name?: string; code?: string; message?: string };
  if (
    error.name === "MainChannelNotFoundError" ||
    error.code === "CHANNEL_NOT_FOUND"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_FOUND",
      title: "Main Channel Missing",
      message: "The primary channel record was not found in the database. Please check your configuration and initialization status.",
      showMaintenanceNote: true,
    };
  }
  if (
    error.name === "MainChannelNotApprovedError" ||
    error.code === "CHANNEL_NOT_APPROVED"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_APPROVED",
      title: "Channel Not Approved",
      message: "The main channel is currently not approved. Public access and admin settings are restricted.",
      showMaintenanceNote: true,
    };
  }
  if (
    error.name === "MainChannelNotPrimaryError" ||
    error.code === "CHANNEL_NOT_PRIMARY"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_PRIMARY",
      title: "Channel Not Primary",
      message: "This channel is not marked as the primary channel. Admin settings can only be accessed for the primary channel.",
      showMaintenanceNote: true,
    };
  }

  if (error.code === "P2021" || error.code === "P2022") {
    return {
      code: "DB_SCHEMA_MISMATCH",
      title: "Database Schema Mismatch",
      message:
        "Database schema is out of date or missing tables/columns. Please run 'npm run db:migrate:deploy'.",
      showMaintenanceNote: true,
    };
  }

  if (
    error.code === "P1001" ||
    error.code === "P1003" ||
    error.code === "P1008" ||
    error.name === "PrismaClientInitializationError"
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
