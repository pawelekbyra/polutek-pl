"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Search, ShieldCheck, Users, Heart, CreditCard, MessageSquare, Download, Filter, Globe, Trash2, Mail } from "@/app/components/icons";
import { UserPatronActions } from "./UserPatronActions";
import { logger } from "@/lib/logger";
import Image from "next/image";
import { AdminUserListItemDto as AdminUserListItem } from "@/lib/modules/users";
import { AdminUsersPageSkeleton } from "@/components/skeletons/admin";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [stats, setStats] = useState<
any>(null);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [patronFilter, setPatronFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [patronSourceFilter, setPatronSourceFilter] = useState("ALL");
  const [isDeletedFilter, setIsDeletedFilter] = useState<boolean>(false);
  const [hasPaymentsFilter, setHasPaymentsFilter] = useState<boolean>(false);
  const [hasSubscriptionsFilter, setHasSubscriptionsFilter] = useState<boolean>(false);
  const [orderBy, setOrderBy] = useState<string>("createdAt");

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/users/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      logger.error("Failed to fetch user stats", err);
    }
  };

  const fetchUsers = useCallback(async (p = page) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/admin/users?page=${p}&query=${encodeURIComponent(searchQuery)}&orderBy=${orderBy}`;
      if (roleFilter !== "ALL") url += `&role=${roleFilter}`;
      if (patronFilter !== "ALL") url += `&isPatron=${patronFilter === "PATRON"}`;
      if (languageFilter !== "ALL") url += `&language=${languageFilter}`;
      if (patronSourceFilter !== "ALL") url += `&patronSource=${patronSourceFilter}`;
      if (isDeletedFilter) url += `&isDeleted=true`;
      if (hasPaymentsFilter) url += `&hasPayments=true`;
      if (hasSubscriptionsFilter) url += `&hasSubscriptions=true`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      } else {
        const err = await res.json();
        setError(err.error || "Nie udało się pobrać listy użytkowników.");
      }
    } catch (err) {
      logger.error("Failed to fetch users", err);
      setError("Wystąpił błąd połączenia.");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter, patronFilter, languageFilter, patronSourceFilter, isDeletedFilter, hasPaymentsFilter, hasSubscriptionsFilter, orderBy]);

  useEffect(() => {
    fetchStats();
    fetchUsers(1);
  }, [roleFilter, patronFilter, languageFilter, patronSourceFilter, isDeletedFilter, hasPaymentsFilter, hasSubscriptionsFilter, orderBy, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const exportCsv = () => {
      let url = `/api/admin/users/export?query=${encodeURIComponent(searchQuery)}&orderBy=${orderBy}`;
      if (roleFilter !== "ALL") url += `&role=${roleFilter}`;
      if (patronFilter !== "ALL") url += `&isPatron=${patronFilter === "PATRON"}`;
      if (languageFilter !== "ALL") url += `&language=${languageFilter}`;
      if (patronSourceFilter !== "ALL") url += `&patronSource=${patronSourceFilter}`;
      if (isDeletedFilter) url += `&isDeleted=true`;
      if (hasPaymentsFilter) url += `&hasPayments=true`;
      if (hasSubscriptionsFilter) url += `&hasSubscriptions=true`;
      window.open(url, "_blank");
  };

  if (isLoading && page === 1 && users.length === 0) {
    return (
      <div className="min-h-screen bg-muted/20 text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
           <AdminUsersPageSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" asChild className="-ml-3 h-8 px-2">
              <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do panelu</Link>
            </Button>
            <Button variant="outline" onClick={exportCsv} size="sm">
                <Download className="mr-2 h-4 w-4" /> Eksportuj CSV
            </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Użytkownicy i Patroni</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Zarządzaj społecznością, weryfikuj statusy patronów i monitoruj aktywność finansową.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Wszyscy" value={stats.totalUsers} icon={<Users className="h-5 w-5" />} color="blue" />
            <StatCard label="Patroni" value={stats.patrons} icon={<Heart className="h-5 w-5" />} color="amber" />
            <StatCard label="Wpłaty" value={stats.totalPayments} icon={<CreditCard className="h-5 w-5" />} color="green" />
            <StatCard label="Komentarze" value={stats.totalComments} icon={<MessageSquare className="h-5 w-5" />} color="purple" />
          </div>
        )}

        <div className="space-y-4 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <form onSubmit={handleSearch} className="w-full lg:w-1/3 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="E-mail, nazwa, ID..."
                        className="pl-9 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-9">Szukaj</Button>
                </form>

                <div className="flex flex-wrap gap-2 items-center flex-1">
                    <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || "ALL")}>
                        <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="Rola" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie role</SelectItem>
                            <SelectItem value="ADMIN">Administrator</SelectItem>
                            <SelectItem value="USER">Użytkownik</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={patronFilter} onValueChange={(v) => setPatronFilter(v || "ALL")}>
                        <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszyscy</SelectItem>
                            <SelectItem value="PATRON">Tylko Patroni</SelectItem>
                            <SelectItem value="NON_PATRON">Nie-Patroni</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={languageFilter} onValueChange={(v) => setLanguageFilter(v || "ALL")}>
                        <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue placeholder="Język" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Język: Dowolny</SelectItem>
                            <SelectItem value="pl">Polski (PL)</SelectItem>
                            <SelectItem value="en">Angielski (EN)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={patronSourceFilter} onValueChange={(v) => { setPatronSourceFilter(v || "ALL"); setPage(1); }}>
                        <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Źródło Patronatu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Dowolne źródło</SelectItem>
                            <SelectItem value="STRIPE_TIP">STRIPE_TIP</SelectItem>
                            <SelectItem value="PAYMENT">PAYMENT</SelectItem>
                            <SelectItem value="REFERRAL">REFERRAL</SelectItem>
                            <SelectItem value="ADMIN">ADMIN</SelectItem>
                            <SelectItem value="MIGRATION">MIGRATION</SelectItem>
                            <SelectItem value="LEGACY">LEGACY</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={orderBy} onValueChange={(v) => setOrderBy(v || "createdAt")}>
                        <SelectTrigger className="w-[160px] h-9 text-xs">
                            <div className="flex items-center gap-2"><Filter className="h-3 w-3 opacity-70" /><SelectValue placeholder="Sortuj" /></div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">Data dołączenia</SelectItem>
                            <SelectItem value="patronSince">Od kiedy patron (aktywny grant)</SelectItem>
                            <SelectItem value="email">E-mail (alfabetycznie)</SelectItem>
                            <SelectItem value="referralPoints">Punkty poleceń</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex flex-wrap gap-4 items-center bg-background/50 px-3 py-1.5 rounded-md border h-9">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="deleted" checked={isDeletedFilter} onCheckedChange={(v) => setIsDeletedFilter(!!v)} />
                            <Label htmlFor="deleted" className="text-[10px] font-bold uppercase cursor-pointer">Usunięci</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="payments" checked={hasPaymentsFilter} onCheckedChange={(v) => setHasPaymentsFilter(!!v)} />
                            <Label htmlFor="payments" className="text-[10px] font-bold uppercase cursor-pointer">Płacący</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="subs" checked={hasSubscriptionsFilter} onCheckedChange={(v) => setHasSubscriptionsFilter(!!v)} />
                            <Label htmlFor="subs" className="text-[10px] font-bold uppercase cursor-pointer">Follow</Label>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <Card className="shadow-sm border-0">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
                <CardTitle className="text-lg flex items-center gap-2">Lista użytkowników</CardTitle>
                <CardDescription className="text-xs">Znaleziono {total} wyników.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[10px] uppercase font-bold">Użytkownik</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Status Patronatu</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Wpłaty & Polecenia</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Rola & Język</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Akcje</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Rejestracja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-destructive">
                        <p className="font-bold mb-2">{error}</p>
                        <Button variant="outline" size="sm" onClick={() => fetchUsers(page)}>Spróbuj ponownie</Button>
                      </TableCell>
                    </TableRow>
                  ) : isLoading ? (
                      <TableRow><TableCell colSpan={6} className="py-20 text-center italic text-muted-foreground animate-pulse">Pobieranie listy użytkowników...</TableCell></TableRow>
                  ) : users.map((user) => (
                    <TableRow key={user.id} className={user.isDeleted ? "opacity-50 grayscale bg-muted/20" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 rounded-full overflow-hidden bg-muted border shrink-0">
                                {user.imageUrl && <Image src={user.imageUrl} alt={user.name || ""} fill className="object-cover" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <Link href={`/admin/users/${user.id}`} className="font-bold text-sm hover:underline decoration-primary truncate">{user.email}</Link>
                                <div className="text-[10px] text-muted-foreground truncate">{user.name || user.username || "Bez nazwy"}</div>
                                {user.isDeleted && <Badge variant="destructive" className="w-fit h-4 text-[8px] mt-1">USUNIĘTY</Badge>}
                            </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                            {user.patronTruth?.isPatron ? (
                                <div className="flex flex-col gap-0.5">
                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] w-fit">PATRON (GRANT)</Badge>
                                    <div className="text-[9px] text-muted-foreground">Aktywny grant od: {formatDate(user.activeGrantSince || user.patronTruth.firstActiveGrantAt)}</div>
                                    <div className="text-[8px] uppercase font-bold opacity-60">Źródło grantu: {user.activeGrantSource || user.patronTruth.source || "ACTIVE_GRANT"} · aktywne: {user.activeGrantCount ?? user.patronTruth.activeGrantCount}</div>
                                    {user.patronCacheTruthMismatch && <Badge variant="destructive" className="text-[8px] w-fit">CACHE MISMATCH</Badge>}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-0.5">
                                    <Badge variant="outline" className="text-[10px] w-fit opacity-50">BRAK AKTYWNEGO GRANTU</Badge>
                                    {user.patronCacheTruthMismatch && <Badge variant="destructive" className="text-[8px] w-fit">CACHE MISMATCH</Badge>}
                                </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-2 items-center">
                                <span className="text-[11px] font-bold">
                                    {user.paymentTotals?.length > 0 ? (
                                        user.paymentTotals.map((t:
any) => `${(t.totalPaidMinor/100).toFixed(2)} ${t.currency}`).join(', ')
                                    ) : "0.00 PLN"}
                                </span>
                                <Badge variant="secondary" className="h-4 text-[9px]">{user.paymentCount} płatności</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-muted-foreground font-medium uppercase">Ostatnia: {formatDate(user.lastPaymentAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="h-4 text-[8px]">Ref: {user.referralPoints} pts / {user.referralCount} os.</Badge>
                                {user.hasSubscriptions && <Badge variant="outline" className="h-4 text-[8px] bg-blue-50 text-blue-700 border-blue-100">FOLLOW</Badge>}
                            </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="text-[9px] w-fit font-mono">
                                {user.role}
                            </Badge>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase">
                                <Globe className="h-3 w-3" /> {user.language || 'PL'}
                            </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                            <UserPatronActions userId={user.id} isPatron={user.patronTruth?.isPatron === true} />
                            <Button variant="ghost" size="icon" asChild title="Wyślij wiadomość"><Link href={`/admin/emails?to=${user.email}`}><Mail className="h-4 w-4" /></Link></Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                          <div className="text-[10px] font-medium">{formatDate(user.createdAt)}</div>
                          <div className="text-[9px] text-muted-foreground italic mt-0.5">Zaktualizowano: {formatDate(user.updatedAt)}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-20 text-center text-muted-foreground italic border-b-0">
                          Brak użytkowników spełniających kryteria wyszukiwania.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-8 border-t bg-muted/10">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => fetchUsers(page - 1)}
                    >
                        Poprzednia
                    </Button>
                    <div className="text-sm font-medium">
                        Strona <span className="text-primary font-bold">{page}</span> z {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => fetchUsers(page + 1)}
                    >
                        Następna
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
    const colors: any = {
        blue: "bg-blue-100 text-blue-600 border-blue-200",
        amber: "bg-amber-100 text-amber-600 border-amber-200",
        green: "bg-green-100 text-green-600 border-green-200",
        purple: "bg-purple-100 text-purple-600 border-purple-200"
    };
    return (
        <Card className="shadow-sm border-0">
            <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl border ${colors[color] || colors.blue}`}>{icon}</div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</p>
                        <p className="text-2xl font-black">{value.toLocaleString()}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
