import { toNextJsHandler } from "better-auth/next-js";
import { adminAuth } from "@admin/lib/auth/auth";
import { getAdminAuthMode } from "@admin/lib/config";

export const dynamic = "force-dynamic";
const handler = toNextJsHandler(adminAuth);

/** Access mode has no panel login (no passkey, TOTP or enrollment endpoints): the whole handler answers 404. */
const notInAccessMode = () => new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

export const GET = (request: Request) => (getAdminAuthMode() === "access" ? notInAccessMode() : handler.GET(request));
export const POST = (request: Request) => (getAdminAuthMode() === "access" ? notInAccessMode() : handler.POST(request));
