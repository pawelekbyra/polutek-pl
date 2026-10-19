import { createHash } from "node:crypto";
import { buildChannelFeedXml, feedLastModified, selectFeedVideos, toFeedItem } from "../domain/rss";
import { loadChannelFeedSource } from "../infrastructure/syndication.repository";

export type ChannelFeedResult =
  | { status: "not_found" }
  | { status: "ok"; xml: string; etag: string; lastModified: Date };

/**
 * The public RSS 2.0 feed of one channel (`/channel/<slug>/feed.xml`): the newest 50 published, due videos of a
 * publicly visible channel. Public read: no actor, nothing viewer-specific, no media URLs (no enclosure).
 * An unknown, hidden, suspended or deleted channel is simply "not found".
 */
export async function getChannelFeed(input: { channelKey: string; baseUrl: string; now?: Date }): Promise<ChannelFeedResult> {
  const now = input.now ?? new Date();
  const source = await loadChannelFeedSource(input.channelKey, input.baseUrl, now);
  if (!source) return { status: "not_found" };

  const items = selectFeedVideos(source.rows, now).map((row) => toFeedItem(row, input.baseUrl));
  const xml = buildChannelFeedXml({ baseUrl: input.baseUrl, channel: source.channel, items });
  // Weak: a CDN may recompress the body, the content stays the same.
  const etag = `W/"${createHash("sha1").update(xml).digest("hex")}"`;
  return { status: "ok", xml, etag, lastModified: feedLastModified(items) };
}
