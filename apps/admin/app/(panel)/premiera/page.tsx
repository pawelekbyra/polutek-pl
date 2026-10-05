import type { Metadata } from "next";
import Link from "next/link";
import { getLiveSnapshot, resolveLiveTarget } from "@/lib/modules/admin-analytics";
import { fmtDateTime, fmtRelative } from "@/lib/modules/admin-overview";
import { LiveMonitor } from "@admin/components/analytics/live-monitor";
import { Icon } from "@admin/components/icons";
import { PageHead } from "@admin/components/ui";
import { analyticsDeps } from "@admin/lib/analytics";

export const metadata: Metadata = { title: "Premiera na żywo" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Live premiere mode: the first picture is rendered on the server, then /api/live (SSE) keeps it current. */
export default async function PremierePage({ searchParams }: Props) {
  const sp = await searchParams;
  const deps = analyticsDeps();
  const target = await resolveLiveTarget(deps, one(sp.video));
  const initial = await getLiveSnapshot(deps, { video: target.video, since: target.since });
  const now = deps.now();
  const key = one(sp.video) ?? "";
  return (
    <>
      <PageHead
        title="Premiera na żywo"
        lede={target.video ? <>Film: <strong>{target.video.title}</strong>{target.premiereAt ? ` · premiera ${fmtDateTime(target.premiereAt, now)} (${fmtRelative(target.premiereAt, now)})` : ""}</> : "Cały kanał"}
        actions={<Link className="btn" href="/">Zakończ tryb</Link>}
      />
      <p className="limit-note">
        <Icon name="info" /> {target.reason}
      </p>
      <LiveMonitor initial={initial} videoKey={key || target.video?.id || ""} />
    </>
  );
}
