import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/admin/channel/route";
import { NextRequest } from "next/server";
import {
  getAdminChannelSettings,
  updateAdminChannelSettings,
} from "@/lib/modules/channel";
import { requireAdminForApi } from "@/lib/auth-utils";

vi.mock("@/lib/auth-utils", () => ({
  requireAdminForApi: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

vi.mock("@/lib/modules/channel", () => ({
  getAdminChannelSettings: vi.fn(),
  updateAdminChannelSettings: vi.fn(),
}));

vi.mock("@/lib/errors", () => ({
  handleApiError: vi.fn((err) => ({
    status: 500,
    json: async () => ({ error: "Internal Error" }),
  })),
}));

describe("Admin Channel API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns channel data for admin", async () => {
      (requireAdminForApi as any).mockResolvedValue({ adminUserId: "admin-1" });
      (getAdminChannelSettings as any).mockResolvedValue({ name: "Channel 1" });

      const req = new NextRequest("http://localhost/api/admin/channel");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.creator.name).toBe("Channel 1");
    });

    it("returns error response if not admin", async () => {
      const errorRes = { status: 403, json: async () => ({ error: "Forbidden" }) };
      (requireAdminForApi as any).mockResolvedValue({
        adminUserId: null,
        response: errorRes,
      });

      const req = new NextRequest("http://localhost/api/admin/channel");
      const res = await GET(req);

      expect(res).toBe(errorRes);
    });

    it("handles unknown errors safely", async () => {
      (requireAdminForApi as any).mockResolvedValue({ adminUserId: "admin-1" });
      (getAdminChannelSettings as any).mockRejectedValue(new Error("Unknown"));

      const req = new NextRequest("http://localhost/api/admin/channel");
      const res = (await GET(req)) as any;

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Internal Error");
    });
  });

  describe("PATCH", () => {
    it("updates channel data for admin", async () => {
      (requireAdminForApi as any).mockResolvedValue({ adminUserId: "admin-1" });
      (updateAdminChannelSettings as any).mockResolvedValue({
        name: "New Name",
      });

      const req = new NextRequest("http://localhost/api/admin/channel", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.creator.name).toBe("New Name");
    });
  });
});
