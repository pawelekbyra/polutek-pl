/* v8 ignore file -- thin Next.js route adapter for safe admin diagnostics booleans. */
import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";

export async function GET() {
  const { response } = await requireAdminForApi(
    "GET_ADMIN_EMAILS_STATUS",
  );
  if (response) return response;

  return NextResponse.json({
    provider: "Resend",
    audience: {
      configured: Boolean(process.env.RESEND_AUDIENCE_ID),
    },
    webhooks: {
      status: "UNVERIFIED",
      label: "Niezweryfikowane",
      message:
        "Brak automatycznego health checku webhooków w panelu. Zweryfikuj konfigurację po stronie operatora/provider dashboard.",
    },
  });
}
