import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { APP_NAME } from "@/lib/constants";
export const metadata = { title: `Privacy Policy — ${APP_NAME}` };
export default async function PrivacyPolicyPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "en") notFound();
  return <div className="min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)]"><Navbar/><main className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-brand text-3xl font-bold tracking-tight">Privacy Policy</h1><p className="mt-6 text-base leading-7 text-[var(--chan-body)]">English privacy text is coming soon. Until then, the Polish Privacy Policy remains the binding version.</p></main><Footer/></div>;
}
