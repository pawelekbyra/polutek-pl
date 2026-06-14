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
      title: "Main Channel Not Found",
      message: error.message || "Main channel configuration is missing.",
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
      message: error.message || "Main channel exists but is not approved.",
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
      message: error.message || "Main channel exists but is not primary.",
      showMaintenanceNote: true,
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
