import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AdminStatTileColor = "blue" | "amber" | "green" | "purple" | "red";

const ICON_COLOR_CLASSES: Record<AdminStatTileColor, string> = {
  blue: "bg-blue-100 text-blue-600 border-blue-200",
  amber: "bg-amber-100 text-amber-600 border-amber-200",
  green: "bg-green-100 text-green-600 border-green-200",
  purple: "bg-purple-100 text-purple-600 border-purple-200",
  red: "bg-red-100 text-red-600 border-red-200",
};

const COMPACT_COLOR_CLASSES: Record<AdminStatTileColor, string> = {
  blue: "text-blue-600 border-blue-100 bg-blue-50/50",
  amber: "text-amber-600 border-amber-100 bg-amber-50/50",
  green: "text-green-600 border-green-100 bg-green-50/50",
  purple: "text-purple-600 border-purple-100 bg-purple-50/50",
  red: "text-red-600 border-red-100 bg-red-50/50",
};

interface AdminStatTileProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: AdminStatTileColor;
  /** "default" is the standard icon+value Card used on stats grids; "compact" is a dense, borderless tile for rows of many stats side by side. */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Canonical admin "stat tile" — the shared replacement for the four
 * independent stat-card implementations that used to live in
 * AdminLayoutShell.tsx, users/page.tsx, users/dashboard/page.tsx and
 * notifications/page.tsx. See CLAUDE.md §5 for the pattern this codifies.
 */
export function AdminStatTile({ label, value, icon, color, size = "default", className }: AdminStatTileProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  if (size === "compact") {
    return (
      <div className={cn("rounded-lg border p-2 text-center", color ? COMPACT_COLOR_CLASSES[color] : "bg-muted/30", className)}>
        <p className="truncate text-[9px] font-bold uppercase tracking-wider opacity-60">{label}</p>
        <p className="text-lg font-black">{displayValue}</p>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          {icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", ICON_COLOR_CLASSES[color ?? "blue"])}>
              {icon}
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-black">{displayValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
