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
    notify();
  });
}

export function usePwaInstall() {
  const [canInstallDirectly, setCanInstallDirectly] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setCanInstallDirectly(Boolean(deferredPrompt));

    const onChange = () => {
      setCanInstallDirectly(Boolean(deferredPrompt));
      setInstalled(isStandaloneDisplay());
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
