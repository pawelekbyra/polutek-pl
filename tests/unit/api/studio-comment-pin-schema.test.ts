import { describe, expect, it } from "vitest";
import { commentActionSchema } from "@/lib/api/studio-schemas";

describe("Studio comment actions", () => {
  it("accepts pin and unpin and still rejects unknown actions", () => {
    expect(commentActionSchema.safeParse({ action: "pin" }).success).toBe(true);
    expect(commentActionSchema.safeParse({ action: "unpin" }).success).toBe(true);
    expect(commentActionSchema.safeParse({ action: "star" }).success).toBe(false);
  });
});
