import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_CLOUDFLARE_HEALTH");
  if (response) return response;

  const missing = [
    !process.env.CLOUDFLARE_ACCOUNT_ID ? "CLOUDFLARE_ACCOUNT_ID" : null,
    !process.env.CLOUDFLARE_API_TOKEN ? "CLOUDFLARE_API_TOKEN" : null,
    !process.env.CLOUDFLARE_WEBHOOK_SECRET ? "CLOUDFLARE_WEBHOOK_SECRET" : null,
  ].filter(Boolean) as string[];

  return NextResponse.json({
    configured: missing.length === 0,
    ...(missing.length > 0 ? { missing } : {}),
    runtime: {
      nodeEnv: process.env.NODE_ENV || null,
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelUrl: process.env.VERCEL_URL || null,
      productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    },
  });
}
