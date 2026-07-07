"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import type { VideoMediaState } from "./types";

function label(provider: string) {
  return provider === "CLOUDFLARE_STREAM" ? "Cloudflare Stream" : provider === "MUX" ? "Mux" : provider;
}

export function ActivePlaybackRouteCard({ route }: { route: VideoMediaState["activeRoute"] }) {
  return (
    <div className={cn("rounded-lg border bg-card p-3 shadow-sm", route && "border-green-200")}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Aktywne źródło</span>
        {route ? (
          <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />{label(route.provider)}</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Brak</Badge>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {route ? `Wybrane przez: ${route.activatedBy}` : "Źródło odtwarzania zostanie wybrane po przygotowaniu dostawcy albo ręcznie w trybie zaawansowanym."}
      </p>
    </div>
  );
}
