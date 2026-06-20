import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_CLOUDFLARE_HEALTH");
  if (response) return response;

  const missing = [
    !process.env.CLOUDFLARE_ACCOUNT_ID ? "CLOUDFLARE_ACCOUNT_ID" : null,
    !process.env.CLOUDFLARE_API_TOKEN ? "CLOUDFLARE_API_TOKEN" : null,
  ].filter(Boolean) as string[];

  return NextResponse.json(
    missing.length === 0
      ? { configured: true }
      : { configured: false, missing },
  );
}
