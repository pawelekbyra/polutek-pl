import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listSubscribedChannels } from "@/lib/modules/subscriptions";

describe("listSubscribedChannels", () => {
  it("reads only the given user's follows of publicly visible channels", async () => {
    const findMany = vi.fn(async () => [{ creator: { id: "c1", slug: "a", handle: "a", name: "A" } }]);
    const ctx = createAppContext({ actor: { type: "user", userId: "u1" }, prisma: { subscription: { findMany } } as never });
    const items = await listSubscribedChannels(ctx, "u1");
    expect(items).toEqual([{ id: "c1", slug: "a", handle: "a", name: "A" }]);
    const args = findMany.mock.calls[0][0] as { where: { userId: string; creator: { deletedAt: null; status: { in: string[] } } }; take: number };
    expect(args.where.userId).toBe("u1");
    expect(args.where.creator).toEqual({ deletedAt: null, status: { in: ["ACTIVE", "LIMITED"] } });
    expect(args.take).toBe(50);
  });

  it("caps the page size", async () => {
    const findMany = vi.fn(async () => []);
    const ctx = createAppContext({ actor: { type: "user", userId: "u1" }, prisma: { subscription: { findMany } } as never });
    await listSubscribedChannels(ctx, "u1", 5000);
    expect((findMany.mock.calls[0][0] as { take: number }).take).toBe(100);
  });
});
