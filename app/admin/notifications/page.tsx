"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { AdminStatTile } from "@/app/admin/components/AdminStatTile";
import { Bell, CheckCircle2, AlertCircle } from "@/app/components/icons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationTemplatesEditor } from "./NotificationTemplatesEditor";
import { NotificationBroadcastForm } from "./NotificationBroadcastForm";

type AdminNotificationListItem = {
  id: string;
  kind: string;
  titlePl: string;
  read: boolean;
  createdAt: string;
  userEmail: string | null;
};

export default function NotificationsAdminPage() {
  const [notifications, setNotifications] = useState<AdminNotificationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .finally(() => setIsLoading(false));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Powiadomienia" />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" /> Powiadomienia
          </h1>
          <p className="text-muted-foreground mt-1">Zarządzaj powiadomieniami użytkowników</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <AdminStatTile label="Razem (ostatnie 50)" value={notifications.length} icon={<Bell className="h-5 w-5" />} color="blue" />
          <AdminStatTile label="Nieprzeczytane" value={unreadCount} icon={<AlertCircle className="h-5 w-5" />} color="red" />
          <AdminStatTile label="Przeczytane" value={notifications.length - unreadCount} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        </div>

        <div className="space-y-8">
          <NotificationBroadcastForm />

          <NotificationTemplatesEditor />

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-bold text-sm uppercase tracking-tight">Ostatnie powiadomienia</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[10px] uppercase font-bold">Użytkownik</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Typ</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Tytuł</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : notifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center text-muted-foreground italic border-b-0">
                        Brak powiadomień.
                      </TableCell>
                    </TableRow>
                  ) : (
                    notifications.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs">{n.userEmail}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">{n.kind.toLowerCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{n.titlePl}</TableCell>
                        <TableCell>
                          {n.read ? (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Przeczytane</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Nieprzeczytane</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString("pl-PL", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
