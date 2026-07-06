import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { isLocale } from "@/lib/i18n/routing";
import { APP_NAME } from "@/lib/constants";

export const metadata = { title: `Terms — ${APP_NAME}` };
export default async function TermsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "en") notFound();
  return <div className="min-h-screen bg-background text-[#1a1a1a]"><Navbar/><main className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-3xl font-black uppercase tracking-tighter">Terms of Service</h1><p className="mt-6 text-base leading-7 text-[#555]">English legal text is coming soon. Until then, the Polish Terms remain the binding version for the service.</p></main><Footer/></div>;
}
