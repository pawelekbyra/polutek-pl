import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Default thumbnail proxy is not available in this environment" },
    { status: 404 },
  );
}
