import { toNextJsHandler } from "better-auth/next-js";
import { adminAuth } from "@admin/lib/auth/auth";

export const dynamic = "force-dynamic";
export const { GET, POST } = toNextJsHandler(adminAuth);
