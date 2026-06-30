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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Search, Download, Filter, Calendar } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { logger } from "@/lib/logger";
import Image from "next/image";
import { AdminPaymentListItemDto as AdminPaymentListItem, AdminPaymentsListResponseDto as AdminPaymentsListResponse } from "@/lib/modules/payments";
import { AdminPaymentsPageSkeleton } from "@/components/skeletons/admin";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type RefundDialogState = { open: boolean; payment: AdminPaymentListItem | null; amountInput: string; loading: boolean; error: string | null };
type DisputeSyncState = { open: boolean; payment: AdminPaymentListItem | null; loading: boolean; error: string | null; result: string | null };

export default function AdminPaymentsListPage() {
  const [payments, setPayments] = useState<AdminPaymentListItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [refundDialog, setRefundDialog] = useState<RefundDialogState>({ open: false, payment: null, amountInput: "", loading: false, error: null });
  const [disputeSync, setDisputeSync] = useState<DisputeSyncState>({ open: false, payment: null, loading: false, error: null, result: null });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [refundedOnly, setRefundedOnly] = useState<boolean>(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderBy, setOrderBy] = useState<string>("createdAt");

  const fetchPayments = useCallback(async (p = page) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/admin/payments?page=${p}&query=${encodeURIComponent(searchQuery)}&orderBy=${orderBy}`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (currencyFilter !== "ALL") url += `&currency=${currencyFilter}`;
      if (refundedOnly) url += `&refundedOnly=true`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;

      const res = await fetch(url);
      if (res.ok) {
        const data: AdminPaymentsListResponse = await res.json();
        setPayments(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
        setSummary(data.summary);
      } else {
        const err = await res.json();
        setError(err.error || "Nie udało się pobrać listy płatności.");
      }
    } catch (err) {
      logger.error("Failed to fetch payments", err);
      setError("Wystąpił błąd połączenia.");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, statusFilter, currencyFilter, refundedOnly, dateFrom, dateTo, orderBy]);

  useEffect(() => {
    fetchPayments(1);
  }, [statusFilter, currencyFilter, refundedOnly, orderBy, fetchPayments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments(1);
  };

  const openRefundDialog = (payment: AdminPaymentListItem) => {
    const alreadyRefunded = payment.refundedAmountMinor ?? 0;
    const maxRefundable = (payment.amountMinor - alreadyRefunded) / 100;
    setRefundDialog({ open: true, payment, amountInput: maxRefundable.toFixed(2), loading: false, error: null });
  };

  const submitRefund = async () => {
    if (!refundDialog.payment) return;
    setRefundDialog((s: RefundDialogState) => ({ ...s, loading: true, error: null }));
    try {
      const amountMinor = Math.round(parseFloat(refundDialog.amountInput) * 100);
      const res = await fetch(`/api/admin/payments/${refundDialog.payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMinor }),
      });
      if (res.ok) {
        setRefundDialog((s: RefundDialogState) => ({ ...s, open: false, loading: false }));
        fetchPayments(page);
      } else {
        const data = await res.json();
        setRefundDialog((s: RefundDialogState) => ({ ...s, loading: false, error: data.error || "Nie udało się wykonać zwrotu." }));
      }
    } catch {
      setRefundDialog((s: RefundDialogState) => ({ ...s, loading: false, error: "Błąd połączenia." }));
    }
  };

  const openDisputeSync = (payment: AdminPaymentListItem) => {
    setDisputeSync({ open: true, payment, loading: false, error: null, result: null });
  };

  const submitDisputeSync = async () => {
    if (!disputeSync.payment) return;
    setDisputeSync((s: DisputeSyncState) => ({ ...s, loading: true, error: null, result: null }));
    try {
      const res = await fetch(`/api/admin/payments/${disputeSync.payment.id}/dispute-sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDisputeSync((s: DisputeSyncState) => ({ ...s, loading: false, result: data.message }));
        fetchPayments(page);
      } else {
        setDisputeSync((s: DisputeSyncState) => ({ ...s, loading: false, error: data.error || "Nie udało się zsynchronizować sporu." }));
      }
    } catch {
      setDisputeSync((s: DisputeSyncState) => ({ ...s, loading: false, error: "Błąd połączenia." }));
    }
  };

  if (isLoading && page === 1 && payments.length === 0) {
    return (
      <div className="min-h-screen bg-muted/20 text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
           <AdminPaymentsPageSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNavigation backHref="/admin/users" backLabel="Wróć do listy użytkowników" currentLabel="Płatności użytkowników" breadcrumbs={[{ href: "/admin/users", label: "Użytkownicy" }]} />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Wpłaty i Finanse</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Monitoruj transakcje Stripe, weryfikuj statusy płatności i sumy przychodów.
          </p>
        </div>

        {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {summary.totalSucceeded.map((f: any) => (
                    <Card key={f.currency} className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                Suma {f.currency}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black">{(f.amountMinor / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {f.currency}</div>
                            <div className="text-[10px] text-muted-foreground mt-1 font-medium italic">Filtrowane podsumowanie</div>
                        </CardContent>
                    </Card>
                ))}
                {summary.totalRefunded.some((r: any) => r.amountMinor > 0) && summary.totalRefunded.map((r: any) => r.amountMinor > 0 && (
                    <Card key={`ref-${r.currency}`} className="border-0 shadow-sm border-l-4 border-red-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Zwroty {r.currency}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-red-600">{(r.amountMinor / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {r.currency}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        <div className="space-y-4 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <form onSubmit={handleSearch} className="w-full lg:w-1/3 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Email, ID, Stripe ID..."
                        className="pl-9 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-9">Szukaj</Button>
                </form>

                <div className="flex flex-wrap gap-2 items-center flex-1">
                    <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v || "ALL")}>
                        <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
                            <SelectItem value="SUCCEEDED">Succeeded</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="FAILED">Failed</SelectItem>
                            <SelectItem value="REFUNDED">Refunded</SelectItem>
                            <SelectItem value="CANCELED">Canceled</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={currencyFilter} onValueChange={(v: string) => setCurrencyFilter(v || "ALL")}>
                        <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue placeholder="Waluta" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 h-9 px-3 bg-background border rounded-md">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-[10px] font-bold focus:outline-none" />
                        <span className="text-[10px] opacity-30">—</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-[10px] font-bold focus:outline-none" />
                    </div>

                    <Select value={orderBy} onValueChange={(v: string) => setOrderBy(v || "createdAt")}>
                        <SelectTrigger className="w-[140px] h-9 text-xs">
                             <div className="flex items-center gap-2"><Filter className="h-3 w-3 opacity-70" /><SelectValue placeholder="Sortuj" /></div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">Data (najnowsze)</SelectItem>
                            <SelectItem value="amountMinor">Kwota</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2 bg-background/50 px-3 py-1.5 rounded-md border h-9">
                        <Checkbox id="refunded" checked={refundedOnly} onCheckedChange={(v: boolean | "indeterminate") => setRefundedOnly(!!v)} />
                        <Label htmlFor="refunded" className="text-[10px] font-bold uppercase cursor-pointer">Tylko zwroty</Label>
                    </div>
                </div>
            </div>
        </div>

        <Card className="shadow-sm border-0">
            <CardHeader className="border-b pb-4">
                <CardTitle className="text-lg">Lista transakcji</CardTitle>
                <CardDescription className="text-xs">Znaleziono {total} wyników.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="text-[10px] uppercase font-bold">Użytkownik</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Odbiorca</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Kwota & Waluta</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Stripe ID</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold">Data</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold">Akcje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {error ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-12 text-center text-destructive">
                                        <p className="font-bold mb-2">{error}</p>
                                        <Button variant="outline" size="sm" onClick={() => fetchPayments(page)}>Spróbuj ponownie</Button>
                                    </TableCell>
                                </TableRow>
                            ) : isLoading ? (
                                <TableRow><TableCell colSpan={7} className="py-20 text-center italic text-muted-foreground animate-pulse">Pobieranie płatności...</TableCell></TableRow>
                            ) : payments.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-7 w-7 rounded-full overflow-hidden bg-muted relative border shrink-0">
                                                <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase">{p.email[0]}</div>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <Link href={`/admin/users/${p.userId}`} className="font-bold text-xs hover:underline decoration-primary truncate">{p.email}</Link>
                                                <div className="text-[10px] text-muted-foreground truncate">{p.userName || "Anonim"}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {p.creator ? (
                                            <Link href={`/channel/${p.creator.slug}`} className="inline-flex items-center gap-1.5 hover:underline">
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase py-0 px-1.5 border-amber-200 text-amber-700 bg-amber-50">
                                                    {p.creator.name}
                                                </Badge>
                                            </Link>
                                        ) : (
                                            <span className="text-[9px] text-muted-foreground italic">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className={p.status === 'SUCCEEDED' ? "font-black text-sm" : "font-medium text-sm opacity-60"}>
                                                {(p.amountMinor / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {p.currency}
                                            </div>
                                            {p.refundedAmountMinor > 0 && (
                                                <div className="text-[9px] text-red-600 font-bold uppercase mt-0.5">Zwrócono: {(p.refundedAmountMinor / 100).toFixed(2)}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={p.status === 'SUCCEEDED' ? 'default' : 'secondary'} className={cn(
                                            "text-[9px] font-mono",
                                            p.status === 'SUCCEEDED' && "bg-green-100 text-green-800 hover:bg-green-100",
                                            p.status === 'FAILED' && "bg-red-100 text-red-800",
                                            p.status === 'REFUNDED' && "bg-red-100 text-red-800"
                                        )}>
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-[9px] text-muted-foreground max-w-[150px] truncate">
                                        {p.stripeIntentId || p.stripeSessionId || '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="text-[10px] font-medium">{formatDate(p.createdAt)}</div>
                                        <div className="text-[9px] text-muted-foreground italic mt-0.5">ID: {p.id.split('-')[0]}...</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1.5">
                                            {(p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED' || p.status === 'DISPUTED') && (
                                                <Button size="sm" variant="outline" className="h-7 text-[9px] px-2 text-red-700 border-red-200 hover:bg-red-50" onClick={() => openRefundDialog(p)}>
                                                    Zwrot
                                                </Button>
                                            )}
                                            {(p.status === 'DISPUTED' || p.status === 'CHARGEBACK_LOST') && (
                                                <Button size="sm" variant="outline" className="h-7 text-[9px] px-2 text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => openDisputeSync(p)}>
                                                    Sync sporu
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && payments.length === 0 && (
                                <TableRow><TableCell colSpan={7} className="py-20 text-center text-muted-foreground italic border-b-0">Brak transakcji spełniających kryteria.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 py-8 border-t bg-muted/10">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => fetchPayments(page - 1)}>Poprzednia</Button>
                        <div className="text-sm font-medium">Strona <span className="text-primary font-bold">{page}</span> z {totalPages}</div>
                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => fetchPayments(page + 1)}>Następna</Button>
                    </div>
                )}
            </CardContent>
        </Card>
      </main>

      <Dialog open={refundDialog.open} onOpenChange={(open: boolean) => setRefundDialog(s => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zwrot płatności</DialogTitle>
            <DialogDescription>
              {refundDialog.payment && (
                <>Płatność {refundDialog.payment.id.split('-')[0]}... — {refundDialog.payment.email}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold mb-1 block">Kwota zwrotu ({refundDialog.payment?.currency})</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={refundDialog.amountInput}
                onChange={(e) => setRefundDialog(s => ({ ...s, amountInput: e.target.value }))}
                className="h-9"
              />
              {refundDialog.payment && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Maks. do zwrotu: {((refundDialog.payment.amountMinor - (refundDialog.payment.refundedAmountMinor ?? 0)) / 100).toFixed(2)} {refundDialog.payment.currency}
                </p>
              )}
            </div>
            {refundDialog.error && <p className="text-sm text-destructive font-medium">{refundDialog.error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(s => ({ ...s, open: false }))}>Anuluj</Button>
            <Button variant="destructive" onClick={submitRefund} disabled={refundDialog.loading}>
              {refundDialog.loading ? "Przetwarzanie..." : "Wykonaj zwrot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeSync.open} onOpenChange={(open) => setDisputeSync(s => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Synchronizuj spór ze Stripe</DialogTitle>
            <DialogDescription>
              {disputeSync.payment && (
                <>Płatność {disputeSync.payment.id.split('-')[0]}... — {disputeSync.payment.email}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Pobierze aktualny status sporu z Stripe i zaktualizuje lokalną bazę danych oraz dostęp patrona.
            </p>
            {disputeSync.error && <p className="text-sm text-destructive font-medium mt-3">{disputeSync.error}</p>}
            {disputeSync.result && <p className="text-sm text-green-700 font-medium mt-3">{disputeSync.result}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeSync(s => ({ ...s, open: false }))}>Zamknij</Button>
            {!disputeSync.result && (
              <Button onClick={submitDisputeSync} disabled={disputeSync.loading}>
                {disputeSync.loading ? "Synchronizuję..." : "Synchronizuj"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
