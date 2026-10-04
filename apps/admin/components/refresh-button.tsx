"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "./icons";

/** Re-reads the screen on the server; the current picture stays until the new one is ready (no skeleton). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" aria-busy={pending} onClick={() => start(() => router.refresh())}>
      {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" />}
      {pending ? "Odświeżam…" : "Odśwież"}
    </button>
  );
}
