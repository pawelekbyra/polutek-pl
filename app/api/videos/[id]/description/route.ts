import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getPublicVideoDescription } from "@/lib/modules/video";

export const dynamic = "force-dynamic";

// Never stored by a shared cache (CLAUDE.md 4.13: the public pages are per request).
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The description of one publicly visible video (public on purpose, middleware.ts). The home list carries no
 * descriptions (W03), so the open video's one is read here after an in-page video switch. A hidden, removed, not yet
 * published or unknown video answers 404, the same for all of them.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const detail = await getPublicVideoDescription(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
