import { NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { ExportOwnDataUseCase } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Self-service export of the signed-in person's own data as a JSON download (GDPR art. 15 and 20).
 * Needs a session only (read-only, nothing leaves the account); limited to a few per hour because it
 * reads many tables.
 */
export async function GET() {
  try {
    const actor = await getActorFromAuth({ allowGuest: false });
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit({ key: `account-export:${actor.userId}`, limit: 5, windowMs: 60 * 60 * 1000 });
    if (!limited.success) {
      return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }

    const ctx = createAppContext({ actor });
    const data = await ExportOwnDataUseCase.execute(ctx, actor.userId);
    const stamp = data.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pawelperfect-my-data-${stamp}.json"`,
        "Cache-Control": "no-store",
        // Completeness at a glance: categories cut to the newest rows and records left out (details are in the file).
        "X-Export-Truncated": data.truncatedCategories.join(",") || "none",
        "X-Export-Skipped-Records": String(data.skippedRecords.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
