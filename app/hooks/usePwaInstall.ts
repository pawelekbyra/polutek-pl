"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true // iOS Safari's own "added to home screen" flag
  );
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Once the app has been installed we remember it, so a *later* visit in a normal
// browser tab (where display-mode is no longer standalone and no install prompt
// fires) can still tell "you already have the app" apart from "this browser can't
// install it".
const INSTALLED_FLAG = "polutek_pwa_installed";

function rememberInstalled() {
  try { localStorage.setItem(INSTALLED_FLAG, "1"); } catch {}
}

function wasRememberedInstalled() {
  try { return localStorage.getItem(INSTALLED_FLAG) === "1"; } catch { return false; }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Never let the browser show its own install banner/mini-infobar — the
    // only way to install is our own "Install app" menu item.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    rememberInstalled();
    notify();
  });
}

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<unknown[]>;
};

export function usePwaInstall() {
  const [canInstallDirectly, setCanInstallDirectly] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const resolveInstalled = () => isStandaloneDisplay() || wasRememberedInstalled();
    setInstalled(resolveInstalled());
    setCanInstallDirectly(Boolean(deferredPrompt));

    // Chrome (Android) can confirm the PWA is installed even from a browser tab.
    const nav = navigator as NavigatorWithRelatedApps;
    if (typeof nav.getInstalledRelatedApps === "function") {
      nav.getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            rememberInstalled();
            setInstalled(true);
          }
        })
        .catch(() => {});
    }

    const onChange = () => {
      setCanInstallDirectly(Boolean(deferredPrompt));
      setInstalled(resolveInstalled());
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstallDirectly(false);
    return choice.outcome;
  }, []);

  return {
    installed,
    isIOS: isIOSDevice(),
    canInstallDirectly,
    install,
  };
}
