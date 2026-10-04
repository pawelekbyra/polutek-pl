import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInCard } from "@admin/components/auth/sign-in-card";
import { peekAdminSession } from "@admin/lib/auth/guard";
import { safeNextPath } from "@admin/lib/auth/session-rules";

export const metadata: Metadata = { title: "Logowanie" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const current = await peekAdminSession();
  // Already signed in (e.g. back from a Cloudflare Access re-login, where the strict cookie was not sent).
  if (current?.enrolled) redirect(next);
  if (current && !current.enrolled) redirect("/rejestracja");
  return <SignInCard next={next} expired={sp.powod === "wygasla"} />;
}
