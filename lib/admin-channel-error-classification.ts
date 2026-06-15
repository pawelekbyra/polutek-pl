import { AuthError } from "@/lib/auth-utils";
import { createScopedLogger } from "@/lib/logger";

export interface ClassifiedAdminChannelError {
  code: string;
  title: string;
  message: string;
  showMaintenanceNote: boolean;
}

export function logAdminChannelError(
  err: unknown,
  eventId: string,
  requestId?: string | null,
) {
  const logger = createScopedLogger(requestId ?? null);
  const error = err as { name?: string; code?: string; message?: string };
  const classified = classifyAdminChannelError(err);

  logger.error(`[${eventId}]`, {
    requestId: requestId ?? null,
    errorName: error.name || "Error",
    errorCode: classified.code,
  });
}

export function classifyAdminChannelError(
  err: unknown,
): ClassifiedAdminChannelError {
  if (err instanceof AuthError) {
    return {
      code: "FORBIDDEN",
      title: "Forbidden",
      message: "You do not have access to channel settings.",
      showMaintenanceNote: false,
    };
  }

  const error = err as {
    name?: string;
    code?: string;
    message?: string;
    constructor?: { name?: string };
  };

  // Domain errors
  if (
    error.name === "MainChannelNotFoundError" ||
    error.code === "CHANNEL_NOT_FOUND"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_FOUND",
      title: "Main Channel Not Found",
      message: "Main channel configuration is missing or invalid.",
      showMaintenanceNote: true,
    };
  }
  if (
    error.name === "MainChannelNotApprovedError" ||
    error.code === "CHANNEL_NOT_APPROVED"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_APPROVED",
      title: "Main Channel Not Approved",
      message: "Main channel exists but is not approved.",
      showMaintenanceNote: true,
    };
  }
  if (
    error.name === "MainChannelNotPrimaryError" ||
    error.code === "CHANNEL_NOT_PRIMARY"
  ) {
    return {
      code: "MAIN_CHANNEL_NOT_PRIMARY",
      title: "Main Channel Not Primary",
      message: "Main channel exists but is not primary.",
      showMaintenanceNote: true,
    };
  }

  // Prisma errors
  if (error.code === "P2021" || error.code === "P2022") {
    return {
      code: "DB_SCHEMA_MISMATCH",
      title: "Database Schema Mismatch",
      message: "The database schema does not match the application.",
      showMaintenanceNote: false,
    };
  }

  const connectionErrorCodes = ["P1001", "P1003", "P1008"];
  if (
    connectionErrorCodes.includes(error.code || "") ||
    error.name === "PrismaClientInitializationError" ||
    error.constructor?.name === "PrismaClientInitializationError"
  ) {
    return {
      code: "DB_CONNECTION_ERROR",
      title: "Database Connection Error",
      message: "The database is currently unavailable.",
      showMaintenanceNote: false,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    title: "Internal Error",
    message: "Channel settings could not be loaded due to an internal error.",
    showMaintenanceNote: false,
  };
}
