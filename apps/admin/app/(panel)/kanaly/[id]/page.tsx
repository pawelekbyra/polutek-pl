import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RevokeStrikeForm, StatusForm, StrikeForm, TrustForm, VideoModerationForm } from "@admin/components/channels/channel-forms";
import { Badge, Card, Empty, PageHead } from "@admin/components/ui";
import { fmtDateTime } from "@/lib/modules/admin-overview";
import { CHANNEL_STATUS, loadChannel, loadChannelVideos } from "@admin/lib/channels";

export const metadata: Metadata = { title: "Kanał" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const GIB = 1024 ** 3;
const gib = (n: number) => `${(n / GIB).toFixed(n >= 10 * GIB ? 0 : 1)} GB`;
const MEMBER_ROLE: Record<string, string> = { OWNER: "właściciel", MANAGER: "menedżer", EDITOR: "edytor", MODERATOR: "moderator", TRANSLATOR: "tłumacz" };

export default async function ChannelPage({ params }: Props) {
  const { id } = await params;
  const c = await loadChannel(id);
  if (!c) notFound();
  const videos = await loadChannelVideos(c.id);
  const now = new Date();
  const st = CHANNEL_STATUS[c.status] ?? { kind: "" as const, label: c.status };
  const deleted = c.status === "DELETED";
  return (
    <>
      <PageHead
        title={c.name}
        crumbs={<Link href="/kanaly">← Kanały</Link>}
        lede={
          <span>
            {c.handle ? `@${c.handle} · ` : ""}właściciel: {c.ownerEmail ?? "brak"} · od {fmtDateTime(c.createdAt, now)}
          </span>
        }
        actions={<Badge kind={st.kind}>{st.label}</Badge>}
      />
      <div className="grid">
        <div className="span-6">
          <Card id="ch-status" title="Status" sub={c.statusReason ? `Ostatnia decyzja: ${c.statusReason}` : undefined}>
            {deleted ? (
              <p className="muted">Kanał został usunięty przez właściciela. Czyszczenie nastąpi po upływie okresu karencji.</p>
            ) : (
              <StatusForm channelId={c.id} status={c.status} isPrimary={c.isPrimary} />
            )}
          </Card>
        </div>
        <div className="span-6">
          <Card id="ch-limits" title="Limity i zaufanie" sub={`Wykorzystano ${gib(c.quota.usedStorageBytes)} z ${gib(c.quota.maxStorageBytes)}`}>
            <ul className="plain">
              <li>Maks. plik: {gib(c.quota.maxUploadBytes)}</li>
              <li>Maks. długość filmu: {Math.round(c.quota.maxVideoSeconds / 60)} min</li>
              <li>Wgrań dziennie: {c.quota.maxUploadsPerDay}</li>
              <li>Zadań w kolejce: {c.quota.maxQueuedJobs}</li>
            </ul>
            {c.isPrimary ? <p className="muted">Kanał główny nie podlega limitom wgrywania.</p> : <TrustForm channelId={c.id} level={c.quota.trustLevel} />}
          </Card>
        </div>
        <div className="span-6">
          <Card id="ch-members" title="Osoby z dostępem">
            {c.members.length === 0 ? (
              <Empty icon="users" title="Tylko właściciel konta" />
            ) : (
              <ul className="plain">
                {c.members.map((m) => (
                  <li key={m.userId}>{m.email ?? m.userId} <span className="muted">({MEMBER_ROLE[m.role] ?? m.role})</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="span-6">
          <Card id="ch-stats" title="Statystyki">
            <ul className="plain">
              <li>Filmy: {c.videoCount}</li>
              <li>Subskrybenci: {c.subscribersCount}</li>
              <li>Otwarte zgłoszenia: {c.openReports ? <Link href={`/kanaly?tab=zgloszenia`}>{c.openReports}</Link> : 0}</li>
              {c.isVerified ? <li>Kanał zweryfikowany</li> : null}
            </ul>
          </Card>
        </div>
        <div className="span-12">
          <Card id="ch-strikes" title="Ostrzeżenia">
            {c.strikes.length === 0 ? (
              <p className="muted">Brak ostrzeżeń.</p>
            ) : (
              c.strikes.map((s) => {
                const active = !s.revokedAt && (!s.expiresAt || s.expiresAt > now);
                return (
                  <article className="mod-item" key={s.id}>
                    <div>
                      <strong>{s.policy}</strong> <Badge kind={active ? "warn" : ""} icon={false}>{s.revokedAt ? "cofnięte" : active ? "aktywne" : "wygasłe"}</Badge>
                      <div className="mod-meta"><span>{s.reason}</span><span>{fmtDateTime(s.issuedAt, now)}</span></div>
                      {active ? <RevokeStrikeForm channelId={c.id} strikeId={s.id} /> : null}
                    </div>
                  </article>
                );
              })
            )}
            {deleted ? null : <StrikeForm channelId={c.id} />}
          </Card>
        </div>
        <div className="span-12">
          <Card id="ch-videos" title="Filmy kanału" sub="Decyzja o widoczności filmu, z powodem i wpisem do historii decyzji.">
            {videos.length === 0 ? (
              <p className="muted">Kanał nie ma jeszcze filmów.</p>
            ) : (
              videos.map((v) => (
                <article className="mod-item" key={v.id}>
                  <div>
                    <strong>{v.title}</strong>{" "}
                    <Badge kind={v.moderationStatus === "REMOVED" ? "crit" : v.moderationStatus === "VISIBLE" ? "" : "warn"} icon={false}>{v.moderationStatus}</Badge>
                    <div className="mod-meta"><span>{v.status}</span><span>{v.views} wyświetleń</span><span>{fmtDateTime(v.createdAt, now)}</span></div>
                    <VideoModerationForm channelId={c.id} videoId={v.id} current={v.moderationStatus} />
                  </div>
                </article>
              ))
            )}
          </Card>
        </div>
        <div className="span-12">
          <Card id="ch-decisions" title="Historia decyzji">
            {c.decisions.length === 0 ? (
              <p className="muted">Brak decyzji moderacyjnych.</p>
            ) : (
              <ul className="plain">
                {c.decisions.map((d) => (
                  <li key={d.id}>
                    <strong>{d.action}</strong> · {d.reasonPublic} <span className="muted">({fmtDateTime(d.createdAt, now)})</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
