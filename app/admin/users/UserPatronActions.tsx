"use client";

import { logger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { Button } from "@/components/ui/button";

interface UserPatronActionsProps {
  userId: string;
  isPatron: boolean;
  onActionComplete?: () => void;
}

export function UserPatronActions({ userId, isPatron, onActionComplete }: UserPatronActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  async function updatePatron(action: "grant" | "revoke") {
    const reason = prompt(action === "grant" ? "Podaj powód nadania statusu Patrona:" : "Podaj powód cofnięcia statusu Patrona:");
    if (reason === null) return; // User cancelled

    setIsPending(true);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/patron`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Nie udało się zmienić statusu Patrona.");
      }

      toast(action === "grant" ? "Nadano status Patrona." : "Cofnięto status Patrona.", 'success');

      if (onActionComplete) {
        onActionComplete();
      } else {
        router.refresh();
      }
    } catch (error) {
      logger.error("[USER_PATRON_ACTION_ERROR]", error);
      toast(error instanceof Error ? error.message : "Nie udało się zmienić statusu Patrona.", 'error');
    } finally {
      setIsPending(false);
    }
  }

  return isPatron ? (
    <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={() => updatePatron("revoke")} className="h-8 text-[10px] uppercase font-bold">
      Cofnij Patrona
    </Button>
  ) : (
    <Button type="button" size="sm" disabled={isPending} onClick={() => updatePatron("grant")} className="h-8 text-[10px] uppercase font-bold">
      Nadaj Patrona
    </Button>
  );
}
