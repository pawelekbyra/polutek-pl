"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminVisualShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const keepsPaymentSkin = pathname === "/admin/payments" || pathname.startsWith("/admin/payments/");

  return (
    <div
      className={cn(
        "min-h-[100dvh]",
        keepsPaymentSkin ? "admin-visual-shell--payments" : "admin-visual-shell",
      )}
    >
      {children}
    </div>
  );
}
