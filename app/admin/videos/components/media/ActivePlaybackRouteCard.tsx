"use client";

import { Badge } from "@/components/ui/badge";
import type { VideoMediaState } from "./types";

function label(provider: string) { return provider === "CLOUDFLARE_STREAM" ? "Cloudflare Stream" : provider === "MUX" ? "Mux" : provider; }

export function ActivePlaybackRouteCard({ route }: { route: VideoMediaState["activeRoute"] }) {
  return <div className="rounded-lg border bg-card p-3">
    <div className="flex items-center justify-between"><span className="font-medium">Aktywne źródło</span><Badge variant={route ? "default" : "outline"}>{route ? label(route.provider) : "Brak"}</Badge></div>
    <p className="mt-2 text-xs text-muted-foreground">{route ? `Wybrane przez: ${route.activatedBy}` : "Brak jednoznacznego aktywnego źródła. Wybierz gotowe źródło, aby dokładnie określić, z czego film odtwarza się na stronie."}</p>
  </div>;
}
