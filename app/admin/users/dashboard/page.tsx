"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Heart, CreditCard, MessageSquare, TrendingUp, TrendingDown, DollarSign } from "@/app/components/icons";
import { logger } from "@/lib/logger";
import { AdminUsersDashboardSkeleton } from "@/components/skeletons/admin";

export default function UserDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/users/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        logger.error("Failed to fetch user stats", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <AdminUsersDashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" asChild className="mb-6 -ml-3">
          <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do listy</Link>
        </Button>

        <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Administracja</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Dashboard Użytkowników</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Wszyscy Użytkownicy" value={stats.totalUsers} icon={<Users className="h-6 w-6" />} color="blue" />
          <StatCard title="Aktywni (Nieusunięci)" value={stats.activeUsers} icon={<TrendingUp className="h-6 w-6" />} color="green" />
          <StatCard title="Patroni" value={stats.patrons} icon={<Heart className="h-6 w-6" />} color="amber" />
          <StatCard title="Wszystkie Wpłaty" value={stats.totalPayments} icon={<CreditCard className="h-6 w-6" />} color="purple" />
        </div>

        <h2 className="text-xl font-bold mb-4">Finanse per waluta</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.financials.map((f: any) => (
                <Card key={f.currency}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">{f.currency}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(f.totalAmount / 100).toFixed(2)} {f.currency}</div>
                        <p className="text-xs text-muted-foreground mt-1">Suma zatwierdzonych wpłat</p>
                    </CardContent>
                </Card>
            ))}
            {stats.financials.length === 0 && (
                <Card className="col-span-3">
                    <CardContent className="py-10 text-center text-muted-foreground">Brak zarejestrowanych wpłat.</CardContent>
                </Card>
            )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-100 text-blue-600",
        green: "bg-green-100 text-green-600",
        amber: "bg-amber-100 text-amber-600",
        purple: "bg-purple-100 text-purple-600",
    };

    return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
    );
}
