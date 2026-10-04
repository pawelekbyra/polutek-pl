import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EnrollFlow } from "@admin/components/auth/enroll-flow";
import { peekAdminSession } from "@admin/lib/auth/guard";

export const metadata: Metadata = { title: "Rejestracja administratora" };

export default async function EnrollPage() {
  const current = await peekAdminSession();
  if (current?.enrolled) redirect("/");
  return <EnrollFlow hasSession={!!current} />;
}
