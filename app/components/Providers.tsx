"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LanguageProvider } from "./LanguageContext";
import { ToastProvider } from "@/app/hooks/useToast";
import { MotionConfig } from "framer-motion";

const CLIENT_API_GET_TIMEOUT_MS = 15_000;
const TIMEOUT_PATHS = [
  "/api/media-source",
  "/api/comments",
  "/api/channel/sidebar",
];

function shouldTimeoutClientApiGet(input: RequestInfo | URL, init?: RequestInit) {
  const method = (
    init?.method ||
    (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  if (method !== "GET") return false;

  try {
    const inputUrl =
      typeof input === "string" || input instanceof URL
        ? input.toString()
        : input.url;
    const url = new URL(inputUrl, window.location.origin);

    if (url.origin !== window.location.origin) return false;
    return TIMEOUT_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
  } catch {
    return false;
  }
}

function withTimeoutSignal(init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  timeoutId = setTimeout(() => controller.abort(new DOMException("Client API request timed out", "TimeoutError")), timeoutMs);

  return {
    init: { ...init, signal: controller.signal },
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    },
  };
}

function installClientApiFetchTimeout() {
  const w = window as typeof window & {
    __polutekClientApiFetchTimeoutInstalled?: boolean;
  };

  if (w.__polutekClientApiFetchTimeoutInstalled) return;
  w.__polutekClientApiFetchTimeoutInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldTimeoutClientApiGet(input, init)) {
      return originalFetch(input, init);
    }

    const { init: timedInit, cleanup } = withTimeoutSignal(init, CLIENT_API_GET_TIMEOUT_MS);
    try {
      return await originalFetch(input, timedInit);
    } finally {
      cleanup();
    }
  }) as typeof window.fetch;
}

export default function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: "pl" | "en";
}) {
  if (typeof window !== "undefined") {
    installClientApiFetchTimeout();
  }

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // komentarze świeże 2 minuty
            gcTime: 1000 * 60 * 10,
            refetchOnWindowFocus: false, // YouTube też tak robi
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLanguage={initialLanguage}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
