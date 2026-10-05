// Admin panel (admin.pawelperfect.com): a second Next.js app in the same repo, NOT an npm workspace.
// It has no package.json of its own: it uses the root node_modules (one lockfile, one install) and imports
// shared code from the repo root through the "@/..." alias (tsconfig paths). Build: `next build apps/admin`.
// Decisions and the reasons: docs/architecture/admin-panel.md, section "Faza 1: jak to jest zbudowane".
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack must see the repo root: the app imports ../../lib and ../../node_modules.
  turbopack: { root: repoRoot },
  // Standalone output traces files from the repo root, so the image gets exactly the lib/ and
  // node_modules files the panel uses (server.js lands in .next/standalone/apps/admin/).
  outputFileTracingRoot: repoRoot,
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  poweredByHeader: false,
  // Cloudflare compresses at the edge; origin gzip would buffer the live premiere stream (Server-Sent Events).
  compress: false,
  // Agent guidance for this repo lives in the root CLAUDE.md; do not let `next dev` generate copies here.
  agentRules: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // The panel never renders remote images (thumbnails come in phase 4), so the optimizer stays off.
  images: { unoptimized: true },
  // Types are checked in CI (tsconfig.typecheck.json covers apps/admin), not during the image build.
  typescript: { ignoreBuildErrors: true },
  // Static security headers; the CSP with a per-request nonce is set in proxy.ts.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
