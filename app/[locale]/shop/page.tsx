import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
export default async function ShopPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "en") notFound();
  return <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)]"><Navbar/><main className="mx-auto max-w-3xl px-4 py-20 text-center"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">HUJKARTY</p><h1 className="font-brand mt-4 text-4xl font-bold tracking-tight">Shop coming soon</h1><p className="mt-6 rounded-3xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-8 text-lg leading-8">HUJKARTY — physical collectible cards. They are not an investment, share, equity interest, or financial instrument.</p></main><Footer/></div>;
}
