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
import { ArrowLeft, Search, ShieldCheck, Users, Heart, CreditCard, MessageSquare, Download } from "@/app/components/icons";
import { UserPatronActions } from "./UserPatronActions";
import { logger } from "@/lib/logger";
import Image from "next/image";

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [patronFilter, setPatronFilter] = useState("ALL");

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

  const fetchUsers = useCallback(async (p = page, q = searchQuery, r = roleFilter, pat = patronFilter) => {
    setIsLoading(true);
    try {
      let url = `/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`;
      if (r !== "ALL") url += `&role=${r}`;
      if (pat !== "ALL") url += `&isPatron=${pat === "PATRON"}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } catch (err) {
      logger.error("Failed to fetch users", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter, patronFilter]);

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const exportCsv = () => {
      window.open("/api/admin/users/export", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" asChild className="-ml-3">
              <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do panelu</Link>
            </Button>
            <Button variant="outline" onClick={exportCsv} size="sm">
                <Download className="mr-2 h-4 w-4" /> Eksportuj CSV
            </Button>
        </div>

        <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Administracja</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Użytkownicy i Patroni</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Zarządzaj społecznością, weryfikuj statusy patronów i monitoruj aktywność finansową użytkowników.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Users className="h-6 w-6" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wszyscy</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Heart className="h-6 w-6" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Patroni</p>
                    <p className="text-2xl font-bold">{stats.patrons}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-lg text-green-600"><CreditCard className="h-6 w-6" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wpłaty</p>
                    <p className="text-2xl font-bold">{stats.totalPayments}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><MessageSquare className="h-6 w-6" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Komentarze</p>
                    <p className="text-2xl font-bold">{stats.totalComments}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Szukaj użytkownika..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit">Szukaj</Button>
            </form>
            <div className="flex gap-2">
                <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); fetchUsers(1, searchQuery, val, patronFilter); }}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Rola" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Wszystkie role</SelectItem>
                        <SelectItem value="ADMIN">Administrator</SelectItem>
                        <SelectItem value="USER">Użytkownik</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={patronFilter} onValueChange={(val) => { setPatronFilter(val); fetchUsers(1, searchQuery, roleFilter, val); }}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Wszyscy</SelectItem>
                        <SelectItem value="PATRON">Tylko Patroni</SelectItem>
                        <SelectItem value="NON_PATRON">Nie-Patroni</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Lista użytkowników</CardTitle>
            <CardDescription>Znaleziono {total} użytkowników.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Finanse</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Akcje</TableHead>
                    <TableHead className="text-right">Dołączył</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                      <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center">Ładowanie...</TableCell>
                      </TableRow>
                  ) : users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                            <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted">
                                {user.imageUrl && <Image src={user.imageUrl} alt={user.name || ""} fill className="object-cover" />}
                            </div>
                            <Link href={`/admin/users/${user.id}`} className="hover:underline">
                                <div className="font-medium text-sm">{user.email}</div>
                                <div className="text-xs text-muted-foreground">{user.name || user.username || "Anonim"}</div>
                            </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                            {user.isPatron ? (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                                    Patron {user.patronSource && `(${user.patronSource})`}
                                </Badge>
                            ) : (
                                <Badge variant="outline">Podstawowy</Badge>
                            )}
                            {user.isDeleted && <Badge variant="destructive">Usunięty</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">
                            {user.normalizedTotal > 0 ? (
                                <span className="text-green-600">~{user.normalizedTotal.toFixed(2)} PLN</span>
                            ) : (
                                <span className="text-muted-foreground">0.00 PLN</span>
                            )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Wpłat: {user._count?.payments || 0}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                            {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <UserPatronActions userId={user.id} isPatron={user.isPatron} />
                      </TableCell>
                      <TableCell className="text-right text-[10px] text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Brak użytkowników dla podanego filtra.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => fetchUsers(page - 1)}
                    >
                        Poprzednia
                    </Button>
                    <div className="flex items-center text-sm font-medium">
                        Strona {page} z {totalPages}
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
