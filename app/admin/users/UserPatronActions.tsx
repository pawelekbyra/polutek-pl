"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UserPatronActions({ userId, isPatron }: { userId: string; isPatron: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function updatePatron(action: "grant" | "revoke") {
    setIsPending(true);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/patron`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Nie udało się zmienić statusu Patrona.");
      }

      router.refresh();
    } catch (error) {
      console.error("[USER_PATRON_ACTION_ERROR]", error);
      alert(error instanceof Error ? error.message : "Nie udało się zmienić statusu Patrona.");
    } finally {
      setIsPending(false);
    }
  }

  return isPatron ? (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => updatePatron("revoke")}>
      Cofnij Patrona
    </Button>
  ) : (
    <Button type="button" size="sm" disabled={isPending} onClick={() => updatePatron("grant")}>
      Nadaj Patrona
    </Button>
  );
}
