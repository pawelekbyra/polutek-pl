import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { AuthError, requireAdmin } from "@/lib/auth-utils";
import { AdminVisualShell } from "@/app/admin/components/AdminVisualShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/");
    }

    logger.error("[AdminLayout] Unexpected admin auth error:", error);
    throw error;
  }

  return <AdminVisualShell>{children}</AdminVisualShell>;
}
