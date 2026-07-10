"use server";

import React from "react";
import { getAuth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { AdminLayoutShell } from "../components/AdminLayoutShell";
import AdminNavigation from "../components/AdminNavigation";

async function NotificationsAdminPage() {
  const headersList = await headers();
  const { userId } = await getAuth(headersList as any);

  if (!userId) {
    return <div>Not authenticated</div>;
  }

  // Get user to check if admin
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.role !== "ADMIN") {
    return <div>Access denied</div>;
  }

  // Get all recent notifications
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <AdminLayoutShell>
      <AdminNavigation />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Powiadomienia</h1>
          <p className="text-gray-600 mt-2">Zarządzaj powiadomieniami użytkowników</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Razem powiadomień</p>
            <p className="text-2xl font-bold">{notifications.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Nieprzeczytane</p>
            <p className="text-2xl font-bold text-red-600">
              {notifications.filter((n) => !n.read).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Przeczytane</p>
            <p className="text-2xl font-bold text-green-600">
              {notifications.filter((n) => n.read).length}
            </p>
          </div>
        </div>

        {/* Notifications table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-sm">Użytkownik</th>
                  <th className="text-left px-4 py-3 font-semibold text-sm">Typ</th>
                  <th className="text-left px-4 py-3 font-semibold text-sm">Tytuł</th>
                  <th className="text-left px-4 py-3 font-semibold text-sm">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-sm">Data</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {n.user?.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                        {n.kind.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{n.titlePl}</td>
                    <td className="px-4 py-3 text-sm">
                      {n.read ? (
                        <span className="text-green-600 font-semibold">Przeczytane</span>
                      ) : (
                        <span className="text-red-600 font-semibold">Nieprzeczytane</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
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

          {notifications.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              Brak powiadomień
            </div>
          )}
        </div>

        {/* Note about admin features */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Wkrótce:</strong> Panelna edycja szablonów powiadomień i wysyłanie niestandardowych wiadomości do wybranych grup użytkowników.
          </p>
        </div>
      </div>
    </AdminLayoutShell>
  );
}

export default NotificationsAdminPage;
