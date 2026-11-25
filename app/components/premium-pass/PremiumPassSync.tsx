"use client";
// patron zone (docs/architecture/patron-zone.md, "Premium od razu po płatności"): page-wide part of the refresh after
// the access was activated. The server-rendered surfaces (sidebar and shelf lock tiles, the home page's pass state)
// come back through router.refresh() (client state, the open checkout included, is kept), and the cached comment
// pages are re-asked so the viewer's own comments show the VIP badge. Mounted once in Providers.
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { usePassActivated } from "./pass-activation";

export function PremiumPassSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  usePassActivated(() => {
    router.refresh();
    void queryClient.invalidateQueries({ queryKey: ["comments"] });
    void queryClient.invalidateQueries({ queryKey: ["comment-replies"] });
  });
  return null;
}
