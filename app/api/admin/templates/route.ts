import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createScopedLogger } from "@/lib/logger";
import { handleApiError } from "@/lib/errors";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminEmailTemplateSchema } from "@/lib/api/admin-schemas";
import {
  listEmailTemplates,
  getEmailTemplateBySlug,
  upsertEmailTemplate,
  deleteEmailTemplate,
  getCustomTemplateVariables,
} from "@/lib/modules/email";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

function errorResponse(error: { message: string; code?: string; statusCode: number }) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
}

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId }, requestId: requestId || undefined });
    // The editor of a new (own) template asks which variables it may use.
    if (req.nextUrl.searchParams.get("variables") === "custom") {
      return NextResponse.json({ variables: getCustomTemplateVariables() });
    }
    const slug = req.nextUrl.searchParams.get("slug");
    if (slug) {
      const result = await getEmailTemplateBySlug(ctx, slug);
      return result.ok ? NextResponse.json(result.data) : errorResponse(result.error);
    }
    const result = await listEmailTemplates(ctx);
    return NextResponse.json(result.ok ? result.data : []);
  } catch (err) {
    createScopedLogger(requestId).error("[GET_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}

/** Saves an admin template, or an override of a system mail (validated against its variables). */
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const parsed = await parseAdminBody(req, adminEmailTemplateSchema);
    if (!parsed.ok) return parsed.response;

    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId }, requestId: requestId || undefined });
    const result = await upsertEmailTemplate(ctx, parsed.data);
    return result.ok ? NextResponse.json(result.data) : errorResponse(result.error);
  } catch (err) {
    createScopedLogger(requestId).error("[POST_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}

/** Deletes an admin template; for a system mail this restores the default text. */
export async function DELETE(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const { adminUserId, response } = await requireAdminForApi("DELETE_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId }, requestId: requestId || undefined });
    const result = await deleteEmailTemplate(ctx, slug);
    return result.ok ? NextResponse.json(result.data) : errorResponse(result.error);
  } catch (err) {
    createScopedLogger(requestId).error("[DELETE_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}
