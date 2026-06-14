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
    [new Error("boom"), "INTERNAL_ERROR", false],
  ])(
    "maps %o to %s without universal maintenance advice",
    (error, code, showMaintenanceNote) => {
      const classified = classifyAdminChannelError(error);

      expect(classified.code).toBe(code);
      expect(classified.showMaintenanceNote).toBe(showMaintenanceNote);
      if (code === "FORBIDDEN" || code === "INTERNAL_ERROR") {
        expect(classified.title).not.toBe("Maintenance Required");
        expect(classified.message).not.toMatch(/run maintenance/i);
      }
    },
  );
});
