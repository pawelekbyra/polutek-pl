"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StrategyChoice, VideoDistributionStrategy } from "./types";

export function strategyFromChoice(choice: StrategyChoice): VideoDistributionStrategy {
  if (choice === "MUX") return { mode: "SINGLE_PROVIDER", provider: "MUX", autopublishPolicy: "WHEN_ACTIVE_ROUTE_READY" };
  if (choice === "CLOUDFLARE_STREAM") return { mode: "SINGLE_PROVIDER", provider: "CLOUDFLARE_STREAM", autopublishPolicy: "WHEN_ACTIVE_ROUTE_READY" };
  if (choice === "CLOUDFLARE_MUX") return { mode: "MULTI_PROVIDER", providers: ["CLOUDFLARE_STREAM", "MUX"], preferredProvider: "MUX", selectionPolicy: "PREFER_SELECTED", autopublishPolicy: "WHEN_ANY_TARGET_READY" };
  if (choice === "MANUAL") return { mode: "MANUAL", autopublishPolicy: "NEVER" };
  return { mode: "AUTO", allowedProviders: ["CLOUDFLARE_STREAM", "MUX"], selectionPolicy: "LOWEST_COST", autopublishPolicy: "WHEN_ANY_TARGET_READY" };
}

export function VideoDistributionStrategySelect({ value, onChange, disabled }: { value: StrategyChoice; onChange: (value: StrategyChoice) => void; disabled?: boolean }) {
  return <div className="space-y-2">
    <Label className="text-sm font-semibold">Aktywne źródło po przetworzeniu</Label>
    <Select value={value} onValueChange={(next) => onChange(next as StrategyChoice)} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder="Gdzie chcesz odtwarzać?" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="AUTO">Pierwsze gotowe / najniższy koszt</SelectItem>
        <SelectItem value="CLOUDFLARE_STREAM">Cloudflare Stream</SelectItem>
        <SelectItem value="MUX">Mux</SelectItem>
        <SelectItem value="CLOUDFLARE_MUX">Mux aktywny + Cloudflare zapasowo</SelectItem>
        <SelectItem value="MANUAL">Zaawansowane — bez automatycznego wyboru</SelectItem>
      </SelectContent>
    </Select>
  </div>;
}
