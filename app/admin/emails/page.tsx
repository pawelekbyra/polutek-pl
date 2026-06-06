import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "@/app/components/Navbar";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import { BroadcastEmailForm } from "./broadcast/BroadcastEmailForm";
import { BroadcastHistory } from "./broadcast/BroadcastHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

const DEFAULT_WELCOME_TEMPLATE = {
  slug: "welcome-email",
  subject: "Witaj w {{appName}}, {{firstName}}!",
  html: `
    <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w {{appName}}</h1>
      <p>Cześć {{firstName}}!</p>
      <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy.</p>
      <p>Odwiedź <a href="{{appUrl}}" style="color: #3b82f6; font-weight: bold; text-decoration: none;">{{appName}}</a>, aby zobaczyć najnowsze filmy.</p>
    </div>
  `,
};

export default async function AdminEmailsPage() {
  let template = null;
  try {
    template = await prisma.emailTemplate.findUnique({
      where: { slug: DEFAULT_WELCOME_TEMPLATE.slug },
    select: { slug: true, subject: true, html: true, subjectEn: true, htmlEn: true },
    });
  } catch (err) {
    logger.error("[AdminEmailsPage] Failed to fetch template, falling back to default.", err);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-foreground pb-20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-neutral-900 mb-2">Zarządzanie Emailami</h1>
          <p className="text-neutral-500 font-medium italic">Konfiguracja szablonów systemowych oraz komunikacja z subskrybentami.</p>
        </header>

        <Tabs defaultValue="broadcast" className="space-y-8">
          <TabsList className="bg-white border border-neutral-200 p-1 h-14 rounded-2xl shadow-sm inline-flex mb-8">
            <TabsTrigger value="broadcast" className="rounded-xl px-8 font-black uppercase tracking-widest text-xs data-[state=active]:bg-neutral-900 data-[state=active]:text-white">Broadcast</TabsTrigger>
            <TabsTrigger value="templates" className="rounded-xl px-8 font-black uppercase tracking-widest text-xs data-[state=active]:bg-neutral-900 data-[state=active]:text-white">Szablony Systemowe</TabsTrigger>
          </TabsList>

          <TabsContent value="broadcast" className="space-y-8 focus-visible:outline-none">
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-900">Mailing do subskrybentów</h2>
              <p className="text-sm text-neutral-500">Wiadomość zostanie wysłana do wszystkich osób, które obserwują kanał.</p>
            </div>
            <BroadcastEmailForm />
            <BroadcastHistory />
          </TabsContent>

          <TabsContent value="templates" className="focus-visible:outline-none">
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-900">Automatyczne szablony</h2>
              <p className="text-sm text-neutral-500">Edytuj szablony wiadomości wysyłanych przez system (np. powitanie).</p>
            </div>
            <EmailTemplateEditor initialTemplate={template || DEFAULT_WELCOME_TEMPLATE} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
