import { NextRequest, NextResponse } from "next/server";
import { GET as canonicalGET, PATCH as canonicalPATCH } from "../channel/route";

/** @deprecated Use /api/admin/channel */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    return canonicalGET(req);
}

export async function PATCH(req: NextRequest) {
    return canonicalPATCH(req);
}
