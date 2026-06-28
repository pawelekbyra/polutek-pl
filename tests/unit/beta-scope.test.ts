import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const allowedAppRoutes = [
  "app/admin/channel/page.tsx",
  "app/admin/comments/page.tsx",
  "app/admin/comments/reports/page.tsx",
  "app/admin/emails/page.tsx",
  "app/admin/page.tsx",
  "app/admin/payments/page.tsx",
  "app/admin/users/[userId]/page.tsx",
  "app/admin/users/dashboard/page.tsx",
  "app/admin/users/page.tsx",
  "app/admin/users/payments/page.tsx",
  "app/admin/videos/[id]/edit/page.tsx",
  "app/admin/videos/[id]/page.tsx",
  "app/admin/videos/layout/page.tsx",
  "app/admin/videos/page.tsx",
  "app/api/access/route.ts",
  "app/api/admin/channel/route.ts",
  "app/api/admin/creator/route.ts",
  "app/api/admin/emails/broadcast/route.ts",
  "app/api/admin/emails/responses/route.ts",
  "app/api/admin/emails/status/route.ts",
  "app/api/admin/health/cloudflare/route.ts",
  "app/api/admin/maintenance/main-channel/apply/route.ts",
  "app/api/admin/maintenance/main-channel/preview/route.ts",
  "app/api/admin/payment-settings/route.ts",
  "app/api/admin/payments/route.ts",
  "app/api/admin/stats/route.ts",
  "app/api/admin/subscribers/resync/route.ts",
  "app/api/admin/templates/route.ts",
  "app/api/admin/users/[userId]/patron/route.ts",
  "app/api/admin/users/[userId]/route.ts",
  "app/api/admin/users/export/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/users/stats/route.ts",
  "app/api/admin/videos/[id]/actions/route.ts",
  "app/api/admin/videos/[id]/comments/route.ts",
  "app/api/admin/videos/[id]/original-upload/route.ts",
  "app/api/admin/videos/[id]/sources/route.ts",
  "app/api/admin/videos/[id]/sources/[sourceId]/route.ts",
  "app/api/admin/videos/[id]/sources/mux-upload/route.ts",
  "app/api/admin/comments/[commentId]/delete/route.ts",
  "app/api/admin/comments/[commentId]/heart/route.ts",
  "app/api/admin/comments/[commentId]/hide/route.ts",
  "app/api/admin/comments/[commentId]/restore/route.ts",
  "app/api/admin/comments/reports/[reportId]/resolve/route.ts",
  "app/api/admin/comments/reports/route.ts",
  "app/api/admin/comments/route.ts",
  "app/api/admin/videos/[id]/route.ts",
  "app/api/admin/videos/[id]/upload/route.ts",
  "app/api/comments/[commentId]/context/route.ts",
  "app/api/comments/[commentId]/pin/route.ts",
  "app/api/comments/[commentId]/reaction/route.ts",
  "app/api/comments/[commentId]/replies/route.ts",
  "app/api/comments/[commentId]/report/route.ts",
  "app/api/comments/[commentId]/route.ts",
  "app/api/admin/videos/cover-upload/route.ts",
  "app/api/admin/videos/reorder/route.ts",
  "app/api/admin/videos/resync/route.ts",
  "app/api/admin/videos/route.ts",
  "app/api/channel/sidebar/route.ts",
  "app/api/checkout/create-intent/route.ts",
  "app/api/checkout/route.ts",
  "app/api/comments/route.ts",
  "app/api/diagnostics/cloudflare-stream/route.ts",
  "app/api/health/route.ts",
  "app/api/media-source/[videoId]/route.ts",
  "app/api/media/[...path]/route.ts",
  "app/api/payment-settings/route.ts",
  "app/api/payments/[paymentId]/route.ts",
  "app/api/subscriptions/route.ts",
  "app/api/subscriptions/unsubscribe/route.ts",
  "app/api/user/account/route.ts",
  "app/api/user/language/route.ts",
  "app/api/user/profile/route.ts",
  "app/api/user/sync/route.ts",
  "app/api/videos/[id]/comments/route.ts",
  "app/api/videos/[id]/playback-event/route.ts",
  "app/api/videos/[id]/thumbnail/route.ts",
  "app/api/webhooks/clerk/route.ts",
  "app/api/webhooks/cloudflare-stream/route.ts",
  "app/api/webhooks/mux/route.ts",
  "app/api/webhooks/resend/route.ts",
  "app/api/webhooks/stripe/route.ts",
  "app/channel/[slug]/page.tsx",
  "app/page.tsx",
  "app/polityka-prywatnosci/page.tsx",
  "app/regulamin/page.tsx",
  "app/search/page.tsx",
  "app/unsubscribe/page.tsx",
  "app/watch/[slug]/page.tsx",
].sort();

const approvedRoutesMatchingOutOfScopeWords = new Set([
  "app/api/admin/videos/[id]/original-upload/route.ts",
  "app/api/admin/videos/[id]/upload/route.ts",
  "app/api/admin/videos/[id]/sources/mux-upload/route.ts",
  "app/api/admin/videos/cover-upload/route.ts",
]);

const outOfScopeRoutePatterns = [
  /campaign/i,
  /crowdfunding/i,
  /fundraising/i,
  /marketplace/i,
  /onboarding/i,
  /upload/i,
  /transcod/i,
];

function collectRouteFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) return collectRouteFiles(fullPath, root);
    if (entry !== "page.tsx" && entry !== "route.ts") return [];

    return relative(process.cwd(), fullPath);
  });
}

describe("private beta route surface", () => {
  it("matches the approved app route allowlist", () => {
    const routes = collectRouteFiles(join(process.cwd(), "app")).sort();

    expect(routes).toEqual(allowedAppRoutes);
  });

  it("does not expose out-of-scope marketplace, campaign, upload, or transcoding routes", () => {
    const routes = collectRouteFiles(join(process.cwd(), "app")).sort();
    const outOfScopeRoutes = routes.filter(
      (route) =>
        !approvedRoutesMatchingOutOfScopeWords.has(route) &&
        outOfScopeRoutePatterns.some((pattern) => pattern.test(route)),
    );

    expect(outOfScopeRoutes).toEqual([]);
  });
});
