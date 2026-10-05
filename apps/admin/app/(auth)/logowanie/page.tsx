import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccessNotice } from "@admin/components/auth/access-notice";
import { SignInCard } from "@admin/components/auth/sign-in-card";
import { resolveAccessSession } from "@admin/lib/auth/access-session";
import { peekAdminSession } from "@admin/lib/auth/guard";
import { safeNextPath } from "@admin/lib/auth/session-rules";
import { getAdminAuthMode } from "@admin/lib/config";

export const metadata: Metadata = { title: "Logowanie" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  if (getAdminAuthMode() === "access") {
    // Cloudflare Access is the login. A signed-in person never sees this screen; it must not call requireAdmin (no loop).
    const result = await resolveAccessSession(await headers());
    if (result.ok) redirect(next);
    return <AccessNotice email={result.email ?? null} kind={result.reason === "no_account" ? "no_account" : result.reason === "error" ? "retry" : "legacy"} />;
  }
  const current = await peekAdminSession();
  // Already signed in (e.g. back from a Cloudflare Access re-login, where the strict cookie was not sent).
  if (current?.enrolled) redirect(next);
  if (current && !current.enrolled) redirect("/rejestracja");
  return <SignInCard next={next} expired={sp.powod === "wygasla"} />;
}
