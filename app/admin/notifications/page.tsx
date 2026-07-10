"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { Bell } from "@/app/components/icons";
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> Powiadomienia
          </h1>
          <p className="text-muted-foreground mt-1">Zarządzaj powiadomieniami użytkowników</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Razem (ostatnie 50)</p>
            <p className="text-2xl font-bold">{notifications.length}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Nieprzeczytane</p>
            <p className="text-2xl font-bold text-red-600">{unreadCount}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Przeczytane</p>
            <p className="text-2xl font-bold text-green-600">{notifications.length - unreadCount}</p>
          </div>
        </div>

        <div className="space-y-8">
          <NotificationBroadcastForm />

          <NotificationTemplatesEditor />

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-bold text-sm uppercase tracking-tight">Ostatnie powiadomienia</h2>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-2">
                <div className="h-10 bg-muted animate-pulse rounded" />
                <div className="h-10 bg-muted animate-pulse rounded" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">Brak powiadomień</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">Użytkownik</th>
                      <th className="text-left px-4 py-2 font-semibold">Typ</th>
                      <th className="text-left px-4 py-2 font-semibold">Tytuł</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                      <th className="text-left px-4 py-2 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">{n.userEmail}</td>
                        <td className="px-4 py-2">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                            {n.kind.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2">{n.titlePl}</td>
                        <td className="px-4 py-2">
                          {n.read ? (
                            <span className="text-green-600 font-semibold">Przeczytane</span>
                          ) : (
                            <span className="text-red-600 font-semibold">Nieprzeczytane</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString("pl-PL", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
