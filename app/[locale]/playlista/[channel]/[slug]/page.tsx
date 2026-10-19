import type { Metadata } from "next";
import { generatePlaylistMetadata, renderPlaylistRoute, type PlaylistRouteProps } from "@/app/components/playlists/playlist-route";

// Per viewer (18+ items are for signed-in viewers only) and per request: never a shared cache.
export const dynamic = "force-dynamic";

export function generateMetadata(props: PlaylistRouteProps): Promise<Metadata> {
  return generatePlaylistMetadata(props);
}

export default function PlaylistaPage(props: PlaylistRouteProps) {
  return renderPlaylistRoute(props);
}
