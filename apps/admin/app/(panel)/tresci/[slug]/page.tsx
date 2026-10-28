import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateTime, fmtInt, fmtMoney } from "@/lib/modules/admin-overview";
import { CopyLink } from "@admin/components/content/copy-link";
import { EncodePanel } from "@admin/components/content/encode-panel";
import { FilmTabs } from "@admin/components/content/film-tabs";
import { FilmActions } from "@admin/components/content/film-actions";
import { Icon } from "@admin/components/icons";
import { Badge, Card, Empty, ExternalLink, PageHead, State, Tile } from "@admin/components/ui";
import { auditActor, auditLabel } from "@admin/lib/audit-labels";
import { TIER_LABEL, diagnosticText, hlsOf, loadContentDetail, publicFilmUrl, statusOf, thumbSrc } from "@admin/lib/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await loadContentDetail((await params).slug);
  return { title: d ? `${d.video.title} · Treści` : "Nie znaleziono" };
}

export default async function FilmPage({ params }: Props) {
  const detail = await loadContentDetail((await params).slug);
  if (!detail) notFound();
  const { video: v, pipeline, thumb } = detail;
  const now = new Date();
  const st = statusOf(v, now);
  const hls = hlsOf(v, pipeline);
  const errors = v.diagnostics.filter((d) => d.severity === "ERROR");
  const warnings = v.diagnostics.filter((d) => d.severity === "WARNING");
  const publishBlockers = errors.filter((d) => d.code?.startsWith("VIDEO_PUBLICATION_"));
  const upcoming = st.label === "Premiera";
  const ops = v.status === "PUBLISHED" || v.status === "UNLISTED" ? (["unpublish", "archive", "duplicate"] as const) : v.status === "ARCHIVED" ? (["restore", "duplicate"] as const) : (["publish", "archive", "duplicate"] as const);

  return (
    <>
      <PageHead
        title={v.title}
        crumbs={
          <>
            <Link href="/tresci">Treści</Link>
            <Icon name="right" />
            <span>{v.title}</span>
          </>
        }
        lede={
          <span className="film-meta">
            <Badge kind={st.kind} icon={st.icon}>
              {st.label}
            </Badge>
            <Badge kind="outline" icon={false}>
              {TIER_LABEL[v.tier] ?? v.tier}
            </Badge>
            {v.isMainFeatured ? (
              <Badge kind="info" icon={false}>
                Hero strony głównej
              </Badge>
            ) : null}
            <span className="muted mono">/{v.slug}</span>
          </span>
        }
        actions={
          <>
            <Link className="btn" href={`/tresci/${v.slug}/edycja`}>
              <Icon name="note" />
              Edytuj
            </Link>
            {v.status === "PUBLISHED" ? (
              <ExternalLink className="btn" href={publicFilmUrl(v.slug)} hint="otwiera stronę w nowej karcie">
                Zobacz na stronie
              </ExternalLink>
            ) : null}
            {v.status === "PUBLISHED" ? <CopyLink url={publicFilmUrl(v.slug)} /> : null}
            <FilmActions id={v.id} title={v.title} ops={[...ops]} primary={v.status === "DRAFT" && !publishBlockers.length ? "publish" : undefined} />
          </>
        }
      />
      <FilmTabs slug={v.slug} current="przeglad" />
      <div className="grid">
        <div className="span-8 stack">
          {v.status === "PUBLISHED" ? (
            <div className="tiles" role="group" aria-label="Statystyki filmu">
              <Tile label="Obejrzenia" value={fmtInt(v.views)} />
              <Tile label="Polubienia" value={fmtInt(v.likesCount)} />
              <Tile label="Komentarze" value={fmtInt(v.commentsCount)} />
              <Tile label="Wideo" value={<span className="tile-value-sm">{hls.label}</span>} />
            </div>
          ) : null}
          {upcoming && v.premiereAt ? (
            <div className="banner">
              <Icon name="calendar" />
              <div className="banner-body">
                <span className="banner-title">Premiera {fmtDateTime(v.premiereAt, now)}</span>
                <span className="text-2">Do tego czasu zalogowani widzą kokpit z odliczaniem, goście ekran logowania. Termin zmienisz w edycji.</span>
              </div>
            </div>
          ) : null}
          {v.publishAfterAssetReady && !v.publishAfterAssetReadyCompletedAt ? (
            <div className="banner">
              <Icon name="clock" />
              <div className="banner-body">
                <span className="banner-title">Opublikuje się sam po zakodowaniu</span>
                <span className="text-2">Encoder włączy film, gdy wersja HLS będzie gotowa.{v.publishAfterAssetReadyError ? ` Ostatni błąd: ${v.publishAfterAssetReadyError}` : ""}</span>
              </div>
            </div>
          ) : null}
          <Card id="h-enc" title="Kodowanie i wideo" meta={hls.kind === "muted" ? <span className="muted">{hls.label}</span> : <State kind={hls.kind}>{hls.label}</State>}>
            {pipeline && pipeline.summary !== "NO_ORIGINAL" ? (
              <EncodePanel key={`${pipeline.job?.id ?? "none"}-${pipeline.summary}`} videoId={v.id} slug={v.slug} initial={pipeline} />
            ) : (
              <Empty icon="upload" title="Brak oryginału">
                <Link href={`/tresci/${v.slug}/edycja#oryginal`}>Wgraj plik wideo w edycji</Link>; kodowanie ruszy samo.
              </Empty>
            )}
          </Card>
          <Card id="h-th" title="Miniatura" meta={thumb ? <span title={thumb.detail}><State kind={thumb.kind}>{thumb.label}</State></span> : null} foot={<><span className="muted">{thumb?.detail}</span><Link href={`/tresci/${v.slug}/edycja#miniatura`}>Zmień w edycji</Link></>}>
            <div className="preview-pair">
              <div className="preview">
                <div className="frame">
                  {/* eslint-disable-next-line @next/next/no-img-element -- panel preview route */}
                  <img src={thumbSrc(v)} alt={`Miniatura filmu ${v.title}`} />
                  <span>{v.title}</span>
                </div>
                Kafel na liście
              </div>
              <div className="preview">
                <div className="frame">
                  {/* eslint-disable-next-line @next/next/no-img-element -- panel preview route */}
                  <img src={thumbSrc(v)} alt="" />
                  <span>{v.title}</span>
                </div>
                Hero strony głównej
              </div>
            </div>
          </Card>
          <Card id="h-fund" title="Zbiórka" foot={<Link href={`/tresci/${v.slug}/edycja#zbiorka`}>Zmień w edycji</Link>}>
            {v.fundraisingManualPercent !== null ? (
              <p>Pasek ustawiony ręcznie: <strong>{v.fundraisingManualPercent}%</strong> (bez kwot na stronie).</p>
            ) : v.fundraisingGoalMinor ? (
              <p>
                Cel {fmtMoney(v.fundraisingGoalMinor, v.fundraisingGoalCurrency ?? "PLN")}, liczone {v.fundraisingStartAt ? `od ${fmtDateTime(v.fundraisingStartAt, now)}` : "ze wszystkich napiwków kanału"}. Strona pokazuje tylko procent.
              </p>
            ) : (
              <p className="muted">Bez paska zbiórki.</p>
            )}
          </Card>
        </div>
        <div className="span-4 stack">
          <Card id="h-pre" title="Lista kontrolna" meta={publishBlockers.length ? <Badge kind="crit">Blokuje publikację</Badge> : errors.length ? <Badge kind="warn">Do poprawy</Badge> : warnings.length ? <Badge kind="ok">Gotowe, z uwagami</Badge> : <Badge kind="ok">Gotowe</Badge>}>
            {v.diagnostics.length === 0 ? (
              <p className="muted">Wszystkie kontrole przechodzą.</p>
            ) : (
              <ul className="checklist">
                {[...errors, ...warnings].map((d, i) => (
                  <li key={`${d.code ?? d.field}-${i}`} className={d.severity === "ERROR" ? "crit" : "warn"}>
                    <Icon name={d.severity === "ERROR" ? "crit" : "warn"} />
                    <span>
                      {diagnosticText(d.message)}
                      <span className="sr-only"> ({d.severity === "ERROR" ? "błąd" : "uwaga"})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card id="h-subs" title="Napisy" foot={<Link href={`/tresci/${v.slug}/edycja#napisy`}>Wgraj albo podmień</Link>}>
            <ul className="list">
              {(["pl", "en"] as const).map((lang) => {
                const url = lang === "pl" ? v.subtitleUrlPl : v.subtitleUrlEn;
                return (
                  <li key={lang}>
                    <span className="li-icon">
                      <Icon name="subtitles" />
                    </span>
                    <div className="li-main">
                      <span className="li-title">{lang === "pl" ? "Polski" : "Angielski"}</span>
                      <span className="li-sub">{url ? "plik WebVTT, prywatny (tylko z tokenem filmu)" : "brak pliku"}</span>
                    </div>
                    {url ? <State kind="ok">Jest</State> : <span className="muted">brak</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card id="h-exp" title="Ekspozycja">
            <ul className="list">
              <li>
                <div className="li-main">
                  <span className="li-title">Na liście filmów</span>
                </div>
                {v.showInSidebar ? <State kind="ok">Tak</State> : <span className="muted">Nie</span>}
              </li>
              <li>
                <div className="li-main">
                  <span className="li-title">Hero strony głównej</span>
                </div>
                {v.isMainFeatured ? <State kind="ok">Tak</State> : <span className="muted">Nie</span>}
              </li>
            </ul>
          </Card>
          <section className="card" id="historia" aria-labelledby="h-hist">
            <div className="card-head">
              <h2 id="h-hist">Historia zmian</h2>
            </div>
            {v.auditLogs.length ? (
              <ul className="list">
                {(v.auditLogs as { id: string; action: string; createdAt: string | Date; actorType?: string | null }[]).slice(0, 12).map((a) => (
                  <li key={a.id}>
                    <div className="li-main">
                      <span className="li-title">{auditLabel(a.action)}</span>
                      <span className="li-sub">
                        {fmtDateTime(a.createdAt, now)} · {auditActor(a.actorType)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Brak wpisów.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
