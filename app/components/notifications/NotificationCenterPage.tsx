import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import NotificationCenterClient from "@/app/components/notifications/NotificationCenterClient";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { getServerTx } from "@/lib/i18n/server-tx";
import { APP_NAME } from "@/lib/constants";

export type NotificationCenterPageProps = { params: Promise<{ locale: string }> };

export async function notificationCenterMetadata({ params }: NotificationCenterPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = (await resolvePageLocale(rawLocale)) ?? "pl";
  const tx = await getServerTx(locale);
  return { title: `${tx("Powiadomienia", "Notifications")} · ${APP_NAME}`, robots: { index: false, follow: false } };
}

export default async function NotificationCenterPage({ params }: NotificationCenterPageProps) {
  const { locale: rawLocale } = await params;
  const locale = await resolvePageLocale(rawLocale);
  if (!locale) notFound();
  const session = await auth();
  if (!session.userId) redirect(`/?signin=1&next=${encodeURIComponent(getLocalizedHref(locale, "notifications"))}`);

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
      <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
        <Navbar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-8 focus:outline-none sm:px-6 sm:py-10 lg:px-8">
          <NotificationCenterClient />
        </main>
        <Footer />
      </div>
    </AuthSessionSeedProvider>
  );
}
