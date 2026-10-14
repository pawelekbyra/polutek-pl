"use client";

import { Clock } from "lucide-react";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { formatClock } from "@/lib/video-start-time";

/**
 * "Start at current time" switch of the share menu: when on, every link of the menu carries `?t=`
 * with the player's position at the moment the menu was opened.
 */
export function ShareStartAtItem({
  seconds,
  label,
  checked,
  onCheckedChange,
  className,
}: {
  seconds: number;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      closeOnClick={false}
      className={className}
    >
      <Clock aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span>
        {label} <span className="tabular-nums text-[var(--chan-muted)]">({formatClock(seconds)})</span>
      </span>
    </DropdownMenuCheckboxItem>
  );
}
