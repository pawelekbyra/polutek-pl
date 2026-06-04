import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Mail, Settings, Video, ShieldCheck } from "@/app/components/icons";

const adminSections = [
  {
    title: "Maile",
    description: "Szablony wiadomości, newslettery, powiadomienia.",
    href: "/admin/emails",
    icon: Mail,
  },
  {
    title: "Filmy",
    description: "Dodawanie, edycja, status publikacji, miniatury, dostęp.",
    href: "/admin/videos",
    icon: Video,
  },
  {
    title: "Kanał",
    description: "Nazwa kanału, opis, cover photo, social links, ustawienia profilu.",
    href: "/admin/channel",
    icon: Settings,
  },
  {
    title: "Użytkownicy",
    description: "Lista użytkowników, role, dostęp do treści, status subskrypcji, podstawowe akcje administracyjne.",
    href: "/admin/users",
    icon: ShieldCheck,
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border bg-card/95 p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Panel administracyjny</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">Zarządzaj kanałem</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Wybierz obszar, który chcesz edytować. Filmy, ustawienia kanału, użytkownicy i komunikacja są teraz rozdzielone na czytelne sekcje.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.href} className="group overflow-hidden border bg-card/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-5 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 ring-1 ring-blue-600/15">
                      <Icon className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
                    <p className="min-h-12 text-sm leading-6 text-muted-foreground">{section.description}</p>
                  </div>
                  <Button asChild className="mt-auto w-full justify-between">
                    <Link href={section.href}>
                      Otwórz sekcję
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
