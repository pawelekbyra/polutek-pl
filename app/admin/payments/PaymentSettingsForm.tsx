"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import type { CurrencyLimit } from "@/lib/payments/currency-settings";

type Props = {
  initialLimits: Record<SupportedCurrency, CurrencyLimit>;
};

type EditableField = "patronThreshold" | "patronBoxMin" | "minAmount";

export function PaymentSettingsForm({ initialLimits }: Props) {
  const [limits, setLimits] = useState<Record<SupportedCurrency, CurrencyLimit>>(initialLimits);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function updateField(currency: SupportedCurrency, field: EditableField, raw: string) {
    const next = Number(raw);
    const value = Number.isFinite(next) ? next : 0;
    setLimits((current) => ({
      ...current,
      [currency]: {
        ...current[currency],
        [field]: value,
        [`${field}Minor`]: Math.round(value * 100),
      },
    }));
  }

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
            patronThreshold: limits[currency].patronThreshold,
            patronBoxMin: limits[currency].patronBoxMin,
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

  function fieldGrid(field: EditableField) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUPPORTED_CURRENCIES.map((currency) => (
          <div key={`${field}-${currency}`} className="space-y-2 rounded-2xl border bg-muted/30 p-4">
            <Label htmlFor={`${field}-${currency}`}>{currency}</Label>
            <Input
              id={`${field}-${currency}`}
              type="number"
              min="0.01"
              step="0.01"
              value={limits[currency][field]}
              onChange={(event) => updateField(currency, field, event.target.value)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Płatności" />

      <div className="mb-6 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Płatności</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Bramka wsparcia</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Trzy niezależne kwoty na walutę. Nie mieszaj ich ze sobą — każda steruje czym innym.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span>
              Próg zostania Patronem
            </CardTitle>
            <CardDescription>
              Kwota, którą musi wpłacić <strong>osoba niebędąca patronem</strong>, aby odblokować dożywotni dostęp do Strefy
              Fenkju. To ta kwota widnieje w support boxie dla niepatronów i decyduje o nadaniu statusu patrona po udanej płatności.
            </CardDescription>
          </CardHeader>
          <CardContent>{fieldGrid("patronThreshold")}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span>
              Minimalna wpłata patrona (dowolna kwota)
            </CardTitle>
            <CardDescription>
              Najniższa kwota, jaką <strong>istniejący patron</strong> może wpłacić w support boxie z dowolną kwotą. To osobny
              mechanizm — nie ma nic wspólnego z progiem zostania patronem powyżej.
            </CardDescription>
          </CardHeader>
          <CardContent>{fieldGrid("patronBoxMin")}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Techniczne minimum checkoutu
            </CardTitle>
            <CardDescription>
              Absolutny dolny limit, który akceptuje bramka płatności (Stripe). Zwykle nie ma potrzeby go zmieniać — obie kwoty
              powyżej nie mogą zejść poniżej tej wartości.
            </CardDescription>
          </CardHeader>
          <CardContent>{fieldGrid("minAmount")}</CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {status === "saved" && <span className="text-green-600">Zapisano ustawienia.</span>}
            {status === "error" && <span className="text-destructive">{error}</span>}
            {status === "idle" && <span className="text-muted-foreground">Wszystkie waluty: PLN, EUR, USD, CHF, GBP.</span>}
            {status === "saving" && <span className="text-muted-foreground">Zapisywanie...</span>}
          </div>
          <Button type="submit" disabled={status === "saving"}>
            <Save className="mr-2 h-4 w-4" /> {status === "saving" ? "Zapisuję..." : "Zapisz"}
          </Button>
        </div>
      </form>
    </main>
  );
}
