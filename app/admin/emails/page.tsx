import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/auth-utils";
import { EmailTemplateEditor } from "./EmailTemplateEditor";

export const dynamic = "force-dynamic";

const DEFAULT_WELCOME_TEMPLATE = {
  slug: "welcome-email",
  subject: "Witaj w POLUTEK.PL, {{firstName}}!",
  html: `
    <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w POLUTEK.PL</h1>
      <p>Cześć {{firstName}}!</p>
      <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy.</p>
      <p>Odwiedź <a href="https://polutek.pl" style="color: #3b82f6; font-weight: bold; text-decoration: none;">POLUTEK.PL</a>, aby zobaczyć najnowsze filmy.</p>
    </div>
  `,
};

export default async function AdminEmailsPage() {
  if (!(await verifyAdmin())) {
    redirect("/");
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { slug: DEFAULT_WELCOME_TEMPLATE.slug },
    select: { slug: true, subject: true, html: true },
  });

  return <EmailTemplateEditor initialTemplate={template || DEFAULT_WELCOME_TEMPLATE} />;
}
