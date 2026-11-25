"use client";
// patron zone (docs/architecture/patron-zone.md): whether the Hero viewer holds an active Premium pass ("Kup se Premium"
// vs "Napiwkuj"). Starts from the server-rendered state for the same account, asks the server for another account, and
// asks again right after a Premium purchase on this page (pass-activation.ts), so the button changes without a reload.
import { useEffect, useState } from "react";
import { usePassActivated } from "./pass-activation";
import { fetchPassStatus } from "./usePremiumPass";

export function useHeroPassState(userId: string | null | undefined, initialUserId: string | null | undefined, initialActive: boolean): boolean {
  const [viewer, setViewer] = useState({ userId: initialUserId ?? null, active: initialActive });

  useEffect(() => {
    if (!userId) {
      setViewer({ userId: null, active: false });
      return;
    }
    if (userId === initialUserId) {
      setViewer({ userId, active: initialActive });
      return;
    }
    let current = true;
    void fetchPassStatus().then((status) => {
      if (current) setViewer({ userId, active: status?.pass.state === "active" });
    });
    return () => { current = false; };
  }, [userId, initialUserId, initialActive]);

  usePassActivated(() => {
    if (!userId) return;
    void fetchPassStatus().then((status) => {
      if (status) setViewer({ userId, active: status.pass.state === "active" });
    });
  });

  return Boolean(userId && viewer.userId === userId && viewer.active);
}
