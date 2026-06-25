"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Shield, CheckCircle2, XCircle, ExternalLink } from "@/app/components/icons";
import { AdminBreadcrumbs } from "@/app/admin/components/AdminBreadcrumbs";
import { logger } from "@/lib/logger";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCommentReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/comments/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      logger.error("Failed to fetch reports", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResolve = async (reportId: string, status: 'DISMISSED' | 'ACTION_TAKEN') => {
    try {
        const res = await fetch(`/api/admin/comments/reports/${reportId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ status }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            fetchReports();
        }
    } catch (err) {
        logger.error("Failed to resolve report", err);
    }
  };

  const handleHideComment = async (commentId: string, reportId: string) => {
      try {
          const res = await fetch(`/api/admin/comments/${commentId}/hide`, { method: 'POST' });
          if (res.ok) {
              await handleResolve(reportId, 'ACTION_TAKEN');
          }
      } catch (err) {
          logger.error("Failed to hide comment", err);
      }
  };

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminBreadcrumbs
          items={[{ label: "Admin", href: "/admin" }, { label: "Komentarze", href: "/admin/comments" }, { label: "Zgłoszenia" }]}
          backHref="/admin/comments"
          backLabel="Wróć do komentarzy"
        />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Zgłoszenia Komentarzy</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Przeglądaj i moderuj zgłoszone komentarze od użytkowników.
          </p>
        </div>

        <Card className="shadow-sm border-0">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">Aktywne zgłoszenia</CardTitle>
            <CardDescription className="text-xs">
              {reports.length} zgłoszeń oczekujących na reakcję.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[10px] uppercase font-bold">Komentarz</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Zgłaszający / Powód</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Wideo</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-10 w-full" /></div></TableCell>
                        <TableCell><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-32" /></div></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><div className="flex justify-end gap-2"><Skeleton className="h-7 w-20" /><Skeleton className="h-7 w-20" /></div></TableCell>
                      </TableRow>
                    ))
                  ) : reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center text-muted-foreground italic">
                        Brak aktywnych zgłoszeń.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="max-w-md">
                          <div className="flex flex-col gap-1">
                            <div className="text-xs font-medium text-muted-foreground">
                              Autor: {report.comment.author?.email || 'Nieznany'}
                            </div>
                            <div className="text-sm bg-muted/50 p-2 rounded border italic">
                              &quot;{report.comment.text}&quot;
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                Status: <Badge variant="outline" className="text-[9px] py-0">{report.comment.status}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="text-xs font-bold text-red-600 uppercase tracking-tight">
                              {report.reason}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                Przez: {report.reporter.email}
                            </div>
                            {report.note && (
                                <div className="text-[10px] bg-amber-50 text-amber-800 p-1 rounded border border-amber-100">
                                    Notatka: {report.note}
                                </div>
                            )}
                            <div className="text-[9px] text-muted-foreground italic">
                              {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale: pl })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                            <Link
                                href={`/watch/${report.comment.video.slug}`}
                                className="flex items-center gap-1 text-xs font-medium hover:underline text-blue-600"
                                target="_blank"
                            >
                                {report.comment.video.title} <ExternalLink size={10} />
                            </Link>
                        </TableCell>
                        <TableCell>
                            <Badge
                                variant={report.status === 'PENDING' ? 'default' : 'secondary'}
                                className={cn(
                                    "text-[9px] uppercase",
                                    report.status === 'PENDING' ? "bg-amber-100 text-amber-800 hover:bg-amber-100" :
                                    report.status === 'ACTION_TAKEN' ? "bg-green-100 text-green-800" : ""
                                )}
                            >
                                {report.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {report.status === 'PENDING' && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-[10px] text-green-600 border-green-200 hover:bg-green-50"
                                        onClick={() => handleResolve(report.id, 'DISMISSED')}
                                    >
                                        <CheckCircle2 size={12} className="mr-1" /> Oddal
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-[10px] text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => handleHideComment(report.comment.id, report.id)}
                                    >
                                        <Shield size={12} className="mr-1" /> Ukryj i zamknij
                                    </Button>
                                </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
