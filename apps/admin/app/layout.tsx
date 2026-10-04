import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { IconSprite } from "@admin/components/icons";
import { THEME_BOOT_SCRIPT } from "@admin/lib/theme-boot";
import "./panel.css";
import "./charts.css";
import "./scale.css";
import "./shell.css";
import "./auth.css";
import "./content.css";

export const metadata: Metadata = {
  title: { default: "Panel PP", template: "%s · Panel PP" },
  description: "Panel administratora pawelperfect.com",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

// Every page is rendered per request: the CSP nonce, the session and the data are per request.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
