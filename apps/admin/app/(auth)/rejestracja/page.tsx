import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EnrollFlow } from "@admin/components/auth/enroll-flow";
import { peekAdminSession } from "@admin/lib/auth/guard";
import { getAdminAuthMode } from "@admin/lib/config";

export const metadata: Metadata = { title: "Rejestracja administratora" };

export default async function EnrollPage() {
  // Access mode has no enrollment (no passkey, no TOTP): the address is kept only so old links land somewhere sensible.
  if (getAdminAuthMode() === "access") redirect("/");
  const current = await peekAdminSession();
  if (current?.enrolled) redirect("/");
  return <EnrollFlow hasSession={!!current} />;
}
