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
 * "Cel zbiórki" (CLAUDE.md "Fundraising progress bar"): the goal behind the
 * amount-free progress bar under the video's title. Empty amount = no bar.
 */
export function FundraisingGoalCard({ value, onChange, disabled }: FundraisingGoalCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Coins className="h-5 w-5" /> Cel zbiórki</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
          Pod tytułem filmu pojawi się pasek postępu — bez kwot i procentów. Liczą się wszystkie udane napiwki
          na kanale od tej daty (puste pole = od początku), po odjęciu zwrotów; inne waluty są przeliczane po
          kursie orientacyjnym. Wyczyść kwotę, aby ukryć pasek.
        </p>
      </CardContent>
    </Card>
  );
}
