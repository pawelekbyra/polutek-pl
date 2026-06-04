import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search, ShieldCheck } from "@/app/components/icons";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams?: { q?: string };
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const query = (searchParams?.q || "").trim();
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      isPatron: true,
      patronSince: true,
      isDeleted: true,
      createdAt: true,
      subscriptions: { select: { id: true }, take: 1 },
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" asChild className="mb-6 -ml-3">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do panelu</Link>
        </Button>

        <div className="mb-6 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Administracja</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Użytkownicy</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Lista użytkowników, role, dostęp do treści, status subskrypcji i podstawowe informacje administracyjne. MVP jest tylko do odczytu — bez destrukcyjnych akcji.
          </p>
        </div>

        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Lista użytkowników</CardTitle>
              <CardDescription>Pokazujemy maksymalnie 100 najnowszych kont z bazy Prisma.</CardDescription>
            </div>
            <form className="flex w-full gap-2 md:max-w-sm" action="/admin/users">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={query} placeholder="Szukaj po e-mailu lub nazwie" className="pl-9" />
              </div>
              <Button type="submit">Szukaj</Button>
            </form>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Dostęp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Utworzono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.email}</div>
                        <div className="text-xs text-muted-foreground">{user.name || user.username || "Brak nazwy"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.isPatron && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Patron</Badge>}
                          {user.subscriptions.length > 0 && <Badge variant="secondary">Subskrypcja</Badge>}
                          {!user.isPatron && user.subscriptions.length === 0 && <Badge variant="outline">Podstawowy</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isDeleted ? "destructive" : "outline"}>{user.isDeleted ? "Usunięty" : "Aktywny"}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Brak użytkowników dla podanego filtra.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
