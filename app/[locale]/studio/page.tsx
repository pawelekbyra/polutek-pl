import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import StudioApp from "@/app/components/studio/StudioApp";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";
import { getServerTx } from "@/lib/i18n/server-tx";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

type StudioPageProps = { params: Promise<{ locale: string }> };

/** The Studio is a signed-in workspace: never indexed, never cached. */
export async function generateMetadata(props: StudioPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await props.params;
  const locale = (await resolvePageLocale(rawLocale)) ?? "pl";
  const tx = await getServerTx(locale);
  return { title: `${tx("Studio twórcy", "Creator Studio")} · ${APP_NAME}`, robots: { index: false, follow: false } };
}

export default async function StudioPage(props: StudioPageProps) {
  const { locale: rawLocale } = await props.params;
  const locale = await resolvePageLocale(rawLocale);
  if (!locale) notFound();
  const tx = await getServerTx(locale);
  // The session goes into the first HTML so the navbar renders final. The middleware already redirected
  // signed-out visitors to the sign-in dialog; the Studio API re-checks the session on every call.
  const session = await auth();

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
      <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
        <Navbar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-10 focus:outline-none sm:px-6 lg:px-8">
          <div className="mb-8 border-b border-[var(--chan-line)] pb-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">{APP_NAME}</p>
            <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--chan-ink)] sm:text-4xl">
              {tx("Studio twórcy", "Creator Studio")}
            </h1>
          </div>
          <StudioApp />
        </main>
        <Footer />
      </div>
    </AuthSessionSeedProvider>
  );
}
