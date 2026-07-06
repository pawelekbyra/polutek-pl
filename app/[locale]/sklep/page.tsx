import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
export default async function SklepPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "pl") notFound();
  return <div className="min-h-screen paper-surface ink-text"><Navbar/><main className="mx-auto max-w-3xl px-4 py-20 text-center"><p className="text-xs font-black uppercase tracking-[0.25em] muted-text">HUJKARTY</p><h1 className="mt-4 text-4xl font-black tracking-tight">Sklep w przygotowaniu</h1><p className="mt-6 rounded-3xl border paper-border paper-panel p-8 text-lg leading-8">HUJKARTY — fizyczne karty kolekcjonerskie. Nie są inwestycją, akcją, udziałem ani instrumentem finansowym.</p></main><Footer/></div>;
}
