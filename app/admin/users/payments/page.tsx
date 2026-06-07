"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CreditCard, Search, Download, Filter } from "@/app/components/icons";
import { logger } from "@/lib/logger";
import Image from "next/image";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminPaymentsListPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchPayments = useCallback(async (p = page, q = searchQuery, s = statusFilter) => {
    setIsLoading(true);
    try {
      let url = `/api/admin/payments?page=${p}&q=${encodeURIComponent(q)}`;
      if (s !== "ALL") url += `&status=${s}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
        setStats(data.stats);
      }
    } catch (err) {
      logger.error("Failed to fetch payments", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" asChild className="mb-6 -ml-3">
          <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do użytkowników</Link>
        </Button>

        <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Administracja</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Wpłaty i Finanse</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Monitoruj wszystkie transakcje Stripe, weryfikuj statusy płatności i sumy przychodów.
          </p>
        </div>

        {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.succeeded.map((f: any) => (
                    <Card key={f.currency}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{f.currency} - SUCCEEDED</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{(f.totalAmount / 100).toFixed(2)} {f.currency}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Liczba: {f.count}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Szukaj po email, ID, Stripe ID..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit">Szukaj</Button>
            </form>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val || "ALL"); fetchPayments(1, searchQuery, val || "ALL"); }}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Wszystkie statusy</SelectItem>
                    <SelectItem value="SUCCEEDED">Succeeded</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Lista płatności</CardTitle>
                    <CardDescription>Znaleziono {total} transakcji.</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Użytkownik</TableHead>
                                <TableHead>Kwota</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Stripe ID</TableHead>
                                <TableHead className="text-right">Data</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center">Ładowanie...</TableCell></TableRow>
                            ) : payments.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full overflow-hidden bg-muted relative">
                                                {p.user?.imageUrl && <Image src={p.user.imageUrl} alt="" fill className="object-cover" />}
                                            </div>
                                            <Link href={`/admin/users/${p.userId}`} className="text-xs font-medium hover:underline">
                                                {p.user?.email}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-sm">
                                        {(p.amountMinor / 100).toFixed(2)} {p.currency}
                                        {p.refundedAmountMinor > 0 && (
                                            <div className="text-[10px] text-red-600">Zwrot: {(p.refundedAmountMinor / 100).toFixed(2)}</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={p.status === 'SUCCEEDED' ? 'default' : 'secondary'} className="text-[10px]">
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                                        {p.stripeIntentId || p.stripeSessionId || '—'}
                                    </TableCell>
                                    <TableCell className="text-right text-[10px] text-muted-foreground">
                                        {formatDate(p.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && payments.length === 0 && (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground italic">Brak płatności.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => fetchPayments(page - 1)}>Poprzednia</Button>
                        <div className="flex items-center text-sm font-medium">Strona {page} z {totalPages}</div>
                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => fetchPayments(page + 1)}>Następna</Button>
                    </div>
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
