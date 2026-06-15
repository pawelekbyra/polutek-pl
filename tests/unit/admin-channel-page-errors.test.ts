import { describe, expect, it } from "vitest";
import { AuthError } from "@/lib/auth-utils";
import { classifyAdminChannelError } from "@/lib/admin-channel-error-classification";

describe("admin channel page error classification", () => {
  it.each([
    [new AuthError("FORBIDDEN"), "FORBIDDEN", false],
    [
      { name: "MainChannelNotFoundError", message: "missing" },
      "MAIN_CHANNEL_NOT_FOUND",
      true,
    ],
    [
      { name: "MainChannelNotApprovedError", message: "not approved" },
      "MAIN_CHANNEL_NOT_APPROVED",
      true,
    ],
    [
      { name: "MainChannelNotPrimaryError", message: "not primary" },
      "MAIN_CHANNEL_NOT_PRIMARY",
      true,
    ],
    [{ code: "P2021" }, "DB_SCHEMA_MISMATCH", false],
    [{ code: "P2022" }, "DB_SCHEMA_MISMATCH", false],
    [{ code: "P1001" }, "DB_CONNECTION_ERROR", false],
    [{ name: "PrismaClientInitializationError" }, "DB_CONNECTION_ERROR", false],
    [new Error("boom"), "INTERNAL_ERROR", false],
  ])(
    "maps %o to %s without universal maintenance advice",
    (error, code, showMaintenanceNote) => {
      const classified = classifyAdminChannelError(error);

      expect(classified.code).toBe(code);
      expect(classified.showMaintenanceNote).toBe(showMaintenanceNote);
      expect(classified.title).toBeDefined();
      expect(classified.message).toBeDefined();
    },
  );
});
