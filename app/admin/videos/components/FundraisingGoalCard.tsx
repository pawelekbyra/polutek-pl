"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "@/app/components/icons";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import type { FundraisingFormState } from "./video-utils";

interface FundraisingGoalCardProps {
  value: FundraisingFormState;
  onChange: (next: FundraisingFormState) => void;
  disabled?: boolean;
}

/**
 * "Cel zbiórki" (CLAUDE.md "Fundraising progress bar"). First the hand-set fill
 * (the owner's provisional bar, whole percent); below it, optionally, a goal
 * amount that fills the bar from real tips. A hand-set fill wins; both empty = no bar.
 */
export function FundraisingGoalCard({ value, onChange, disabled }: FundraisingGoalCardProps) {
  const manualActive = value.manualPercent.trim() !== "";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Coins className="h-5 w-5" /> Cel zbiórki</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fundraisingManualPercent">Wypełnienie paska (%) — ręcznie</Label>
          <Input
            id="fundraisingManualPercent"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            placeholder="np. 65"
            value={value.manualPercent}
            onChange={(e) => onChange({ ...value, manualPercent: e.target.value })}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Liczba całkowita 0–100. Pod tytułem filmu pojawi się pasek wypełniony w tym stopniu — bez kwot i
            procentów na ekranie. Puste pole = wyłączone.
          </p>
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">
            Opcjonalnie: cel kwotowy{" "}
            <span className="font-normal text-muted-foreground">
              {manualActive ? "(nieużywany, dopóki jest wypełnienie ręczne)" : "(pasek liczony z napiwków)"}
            </span>
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-2">
              <Label htmlFor="fundraisingAmount">Kwota celu</Label>
              <Input
                id="fundraisingAmount"
                inputMode="decimal"
                placeholder="np. 50000"
                value={value.amount}
                onChange={(e) => onChange({ ...value, amount: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Waluta</Label>
              <Select
                value={value.currency}
                onValueChange={(currency) => onChange({ ...value, currency: (currency || "PLN") as SupportedCurrency })}
                disabled={disabled}
              >
                <SelectTrigger className="w-[92px]" aria-label="Waluta celu"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fundraisingStart">Liczone od</Label>
            <Input
              id="fundraisingStart"
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ ...value, startDate: e.target.value })}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Liczą się wszystkie udane napiwki na kanale od tej daty (puste pole = od początku), po odjęciu zwrotów;
            inne waluty są przeliczane po kursie orientacyjnym. Wyczyść kwotę, aby usunąć cel.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
