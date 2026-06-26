"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings } from "@/app/components/icons";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import type { CurrencyLimit } from "@/lib/payments/currency-settings";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";

type Props = {
  initialLimits: Record<SupportedCurrency, CurrencyLimit>;
};

export function PaymentSettingsForm({ initialLimits }: Props) {
  const [limits, setLimits] = useState<Record<SupportedCurrency, CurrencyLimit>>(initialLimits);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limits: SUPPORTED_CURRENCIES.map((currency) => ({
            currency,
            minAmount: limits[currency].minAmount,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Nie udało się zapisać ustawień płatności.");
      setLimits(payload.limits);
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać ustawień płatności.");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNavigation
        items={[{ label: "Admin", href: "/admin" }, { label: "Płatności", href: "/admin/payments" }]}
        backHref="/admin"
        backLabel="Wróć do panelu"
      />

      <div className="mb-6 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Płatności</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Bramka napiwkowa</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Edytuj minimalną kwotę napiwku osobno dla każdej waluty. Udana płatność automatycznie nadaje status Patrona.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Minimalne kwoty</CardTitle>
          <CardDescription>Kwoty są zapisywane dynamicznie i używane zarówno w interfejsie, jak i w walidacji API checkoutu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {SUPPORTED_CURRENCIES.map((currency) => (
                <div key={currency} className="space-y-2 rounded-2xl border bg-muted/30 p-4">
                  <Label htmlFor={`min-${currency}`}>Minimum {currency}</Label>
                  <Input
                    id={`min-${currency}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={limits[currency].minAmount}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setLimits((current) => ({
                        ...current,
                        [currency]: {
                          ...current[currency],
                          minAmount: Number.isFinite(next) ? next : 0,
                          minAmountMinor: Number.isFinite(next) ? Math.round(next * 100) : 0,
                        },
                      }));
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                {status === "saved" && <span className="text-green-600">Zapisano ustawienia.</span>}
                {status === "error" && <span className="text-destructive">{error}</span>}
                {status === "idle" && <span className="text-muted-foreground">CHF i GBP są dostępne w bramce obok PLN, EUR i USD.</span>}
                {status === "saving" && <span className="text-muted-foreground">Zapisywanie...</span>}
              </div>
              <Button type="submit" disabled={status === "saving"}>
                <Save className="mr-2 h-4 w-4" /> {status === "saving" ? "Zapisuję..." : "Zapisz"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
