"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentFourFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment4?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment4-frame-skin">
      <div className="experiment4-frame-page">{children}</div>

      <style jsx global>{`
        .experiment4-frame-skin {
          min-height: 100vh;
          padding-inline: clamp(12px, 3vw, 44px);
          background: #f8f3e7;
        }

        .experiment4-frame-page {
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: visible;
          background: #fff;
        }

        .experiment4-frame-page > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
        }

        @media (max-width: 768px) {
          .experiment4-frame-skin {
            padding-inline: 0;
          }
        }
      `}</style>
    </div>
  );
}
