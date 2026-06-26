"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Heart,
  CreditCard,
  MessageSquare,
  History,
  Share2,
  ShieldCheck,
  Mail,
  ExternalLink,
  Trash2,
} from "@/app/components/icons";
import { logger } from "@/lib/logger";
import Image from "next/image";
import { UserPatronActions } from "../UserPatronActions";
import { AdminAccessDiagnostics } from "../AdminAccessDiagnostics";
import { AdminUserDetailsSkeleton } from "@/components/skeletons/admin";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function UserDetailsPage(props: {
  params: Promise<{ userId: string }>;
}) {
  const params = use(props.params);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${params.userId}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setError("Nie udało się pobrać danych użytkownika.");
      }
    } catch (err) {
      logger.error("Failed to fetch user details", err);
      setError("Błąd połączenia z serwerem.");
    } finally {
      setIsLoading(false);
    }
  }, [params.userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <AdminUserDetailsSkeleton />
        </main>
      </div>
    );
  }
  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <AdminNavigation
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Użytkownicy", href: "/admin/users" },
              { label: "Szczegóły", href: `/admin/users/${params.userId}` },
            ]}
            backHref="/admin/users"
            backLabel="Wróć do użytkowników"
          />
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Nie można wyświetlić użytkownika</CardTitle>
              <CardDescription>
                {error || "Użytkownik nie został znaleziony."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/users">Wróć do użytkowników</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin">Wróć do admina</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const patronTruth = user.patronDiagnostics?.truth;
  const patronMismatch = user.patronDiagnostics?.cacheTruthMismatch;
  const isPatronByGrantTruth = patronTruth?.isPatron === true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNavigation
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Użytkownicy", href: "/admin/users" },
            { label: "Szczegóły", href: `/admin/users/${params.userId}` },
          ]}
          backHref="/admin/users"
          backLabel="Wróć do użytkowników"
        />

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/3 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="relative h-24 w-24 rounded-full overflow-hidden bg-muted mb-4 border-2 border-primary/20">
                    {user.imageUrl && (
                      <Image
                        src={user.imageUrl}
                        alt={user.name || ""}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <h1 className="text-xl font-bold">
                    {user.name || user.username || "Anonim"}
                  </h1>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                    {isPatronByGrantTruth ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                        Patron (grant truth)
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        Podstawowy (brak aktywnego grantu)
                      </Badge>
                    )}
                    {patronMismatch?.hasMismatch && (
                      <Badge variant="destructive">Cache mismatch</Badge>
                    )}
                    {user.isDeleted && (
                      <Badge variant="destructive">Usunięty</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-8 space-y-4 pt-6 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Clerk ID:</span>
                    <code className="bg-muted px-1 rounded text-[10px]">
                      {user.id}
                    </code>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Język:</span>
                    <span className="font-medium uppercase">
                      {user.language}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dołączył:</span>
                    <span className="font-medium">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Suma wpłat:</span>
                    <span className="font-bold text-green-600">
                      ~{user.normalizedTotal.toFixed(2)} PLN
                    </span>
                  </div>
                </div>

                <div className="mt-8 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    asChild
                  >
                    <a
                      href={`https://dashboard.clerk.com/users/${user.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" /> Zobacz w Clerk
                    </a>
                  </Button>
                  {user.stripeCustomerId && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      asChild
                    >
                      <a
                        href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CreditCard className="mr-2 h-4 w-4" /> Zobacz w Stripe
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Heart className="h-4 w-4 text-amber-500" /> Zarządzanie
                  Patronem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserPatronActions
                  userId={user.id}
                  isPatron={isPatronByGrantTruth}
                  onActionComplete={fetchUser}
                />
                <AdminAccessDiagnostics user={user} formatDate={formatDate} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:flex-1">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-6">
                <TabsTrigger
                  value="summary"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  Podsumowanie
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  Wpłaty
                </TabsTrigger>
                <TabsTrigger
                  value="grants"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  Granty
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  Aktywność
                </TabsTrigger>
                <TabsTrigger
                  value="audit"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  Historia zmian
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                        Komentarze
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {user._count.comments}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                        Reakcje
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {user._count.videoLikes + user._count.videoDislikes}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Subskrybowany kanał
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {user.subscriptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 italic">
                        Brak subskrypcji.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {user.subscriptions.map((s: any) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                                {s.creator.name[0]}
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {s.creator.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Od: {formatDate(s.createdAt)}
                                </div>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/channel/${s.creator.slug}`}>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Historia wpłat (Ostatnie 50)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">
                              Data
                            </th>
                            <th className="px-4 py-2 text-left font-medium">
                              Kwota
                            </th>
                            <th className="px-4 py-2 text-left font-medium">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left font-medium">
                              ID Stripe
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {user.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-4 py-3 whitespace-nowrap text-xs">
                                {formatDate(p.createdAt)}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {(p.amountMinor / 100).toFixed(2)} {p.currency}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    p.status === "SUCCEEDED"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : ""
                                  }
                                >
                                  {p.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-muted-foreground">
                                {p.stripeIntentId || p.stripeSessionId || "—"}
                              </td>
                            </tr>
                          ))}
                          {user.payments.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-10 text-center text-muted-foreground italic"
                              >
                                Brak wpłat.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="grants">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Granty Patrona (Uprawnienia)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {user.patronGrants.map((g: any) => (
                        <div
                          key={g.id}
                          className={`p-4 rounded-xl border ${g.revokedAt ? "opacity-60 bg-muted/20" : "bg-amber-50/30 border-amber-100"}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="uppercase text-[9px]"
                              >
                                {g.source}
                              </Badge>
                              {!g.revokedAt && (
                                <Badge className="bg-green-600 text-[9px]">
                                  Aktywny
                                </Badge>
                              )}
                              {g.revokedAt && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px]"
                                >
                                  Cofnięty
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(g.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {g.reason || "Brak uzasadnienia"}
                          </p>
                          {g.revokedAt && (
                            <p className="mt-2 text-xs text-destructive">
                              Cofnięto: {formatDate(g.revokedAt)}
                            </p>
                          )}
                          {g.grantedById && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Nadany przez: {g.grantedById}
                            </p>
                          )}
                        </div>
                      ))}
                      {user.patronGrants.length === 0 && (
                        <p className="text-center py-10 text-muted-foreground italic">
                          Brak zarejestrowanych grantów.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ostatnie Akcje</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-4 p-4 rounded-lg bg-blue-50/30 border border-blue-100">
                        <MessageSquare className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-bold">Komentarze</p>
                          <p className="text-xs text-muted-foreground">
                            Użytkownik napisał {user._count.comments} komentarzy
                            w serwisie.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 p-4 rounded-lg bg-green-50/30 border border-green-100">
                        <Heart className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-sm font-bold">Reakcje</p>
                          <p className="text-xs text-muted-foreground">
                            Polubień: {user._count.videoLikes}, Dislajków:{" "}
                            {user._count.videoDislikes}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Historia administracyjna (Audit Log)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {user.auditLogs.map((log: any) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-lg border text-xs"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold uppercase text-primary">
                              {log.action}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            Aktor: {log.actorUserId || "SYSTEM"}
                          </p>
                          {log.metadata && (
                            <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                      {user.auditLogs.length === 0 && (
                        <p className="text-center py-10 text-muted-foreground italic">
                          Brak wpisów w audit logu.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
