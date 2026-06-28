"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, EyeOff, Trash2, RotateCcw, Search, Clock, CheckCircle2 } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { SafeAvatar } from "@/app/components/SafeAvatar";
import { useToast } from "@/app/hooks/useToast";
import { CommentDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { Skeleton } from "@/components/ui/skeleton";

const commentActionLabels = {
  hide: "ukrycia komentarza",
  restore: "przywrócenia komentarza",
  delete: "usunięcia komentarza",
  hold: "wstrzymania komentarza",
  approve: "zatwierdzenia komentarza",
} as const;

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialParams = useMemo(() => {
    if (typeof window === "undefined") return { q: "", videoId: "" };

    const params = new URLSearchParams(window.location.search);
    return {
      q: params.get("q") || "",
      videoId: params.get("videoId") || "",
    };
  }, []);
  const [search, setSearch] = useState(initialParams.q);
  const [debouncedSearch, setDebouncedSearch] = useState(initialParams.q);
  const videoId = initialParams.videoId;
  const toast = useToast();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const fetchComments = useCallback(async (searchOverride?: string) => {
    setIsLoading(true);
    const query = searchOverride ?? debouncedSearch;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (videoId) params.set("videoId", videoId);

    try {
      const res = await fetch(`/api/admin/comments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, videoId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const refreshComments = () => fetchComments(search);

  const handleAction = async (commentId: string, action: 'hide' | 'restore' | 'delete' | 'hold' | 'approve') => {
    try {
      const res = await fetch(`/api/admin/comments/${commentId}/${action}`, { method: 'POST' });
      if (res.ok) {
        toast(`Zakończono akcję: ${commentActionLabels[action]}.`, 'success');
        fetchComments();
      } else {
        toast('Nie udało się wykonać akcji na komentarzu.', 'error');
      }
    } catch (err) {
      toast('Błąd sieci podczas wykonywania akcji na komentarzu.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Komentarze" />

        <div className="flex flex-col justify-between gap-4 mb-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" /> Moderacja Komentarzy
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Przeglądaj, ukrywaj, przywracaj i usuwaj komentarze.</p>
          </div>
          <div className="flex gap-2">
             <Input
                placeholder="Szukaj komentarzy..."
                className="w-64 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setDebouncedSearch(search);
                    refreshComments();
                  }
                }}
             />
             <Button onClick={refreshComments} variant="secondary"><Search size={16} /></Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Wszystkie Komentarze</CardTitle>
            <CardDescription>{videoId ? "Zarządzaj komentarzami pod wybranym filmem." : "Zarządzaj dyskusjami w całej aplikacji."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Autor</TableHead>
                  <TableHead>Treść</TableHead>
                  <TableHead>Film</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="flex items-center gap-2"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-4 w-24" /></div></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></div></TableCell>
                    </TableRow>
                  ))
                ) : comments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 opacity-50">Brak komentarzy.</TableCell></TableRow>
                ) : comments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SafeAvatar src={comment.author?.imageUrl} alt={comment.author?.displayName || ""} size={24} fallbackSeed={comment.author?.id} />
                        <span className="text-xs font-medium">{comment.author?.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{comment.text || <span className="italic opacity-50">Treść usunięta</span>}</TableCell>
                    <TableCell className="text-[10px] font-mono opacity-50">{comment.videoId.substring(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] uppercase">{comment.status}</Badge></TableCell>
                    <TableCell className="text-[10px] whitespace-nowrap">{new Date(comment.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {comment.status === 'VISIBLE' && (
                        <>
                          <Button onClick={() => handleAction(comment.id, 'hold')} variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Wstrzymaj do przeglądu"><Clock size={14} /></Button>
                          <Button onClick={() => handleAction(comment.id, 'hide')} variant="ghost" size="icon" className="h-8 w-8" title="Ukryj"><EyeOff size={14} /></Button>
                        </>
                      )}
                      {comment.status === 'HELD_FOR_REVIEW' && (
                        <>
                          <Button onClick={() => handleAction(comment.id, 'approve')} variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Zatwierdź"><CheckCircle2 size={14} /></Button>
                          <Button onClick={() => handleAction(comment.id, 'hide')} variant="ghost" size="icon" className="h-8 w-8" title="Ukryj"><EyeOff size={14} /></Button>
                        </>
                      )}
                      {(comment.status === 'HIDDEN' || comment.status === 'DELETED') && (
                        <Button onClick={() => handleAction(comment.id, 'restore')} variant="ghost" size="icon" className="h-8 w-8"><RotateCcw size={14} /></Button>
                      )}
                      <Button onClick={() => handleAction(comment.id, 'delete')} variant="ghost" size="icon" className="h-8 w-8 text-red-600"><Trash2 size={14} /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
