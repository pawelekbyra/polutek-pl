"use client";

import { useEffect } from "react";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    async function cleanupPersistentCaches() {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
      }

      if ("caches" in window) {
        const keys = await caches.keys().catch(() => []);
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
      }
    }

    void cleanupPersistentCaches();
  }, []);

  return null;
}
