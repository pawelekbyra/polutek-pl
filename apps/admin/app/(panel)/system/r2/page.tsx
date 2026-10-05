import type { Metadata } from "next";
import Link from "next/link";
import { diagnoseR2 } from "@/lib/modules/media";
import { Icon } from "@admin/components/icons";
import { Badge, Card, Check, PageHead } from "@admin/components/ui";
import { requireAdmin } from "@admin/lib/auth/guard";

export const metadata: Metadata = { title: "Diagnostyka R2" };

/** R2 settings of THIS process (names, presence, shortened ids; never secrets) and, on request, a HeadBucket per bucket. */
export default async function R2DiagnosticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/system/r2");
  const test = (await searchParams).test === "1";
  const d = await diagnoseR2({ testConnection: test });
  return (
    <>
      <PageHead
        title="Diagnostyka R2"
        crumbs={<><Link href="/system">System</Link><Icon name="right" /><span>Diagnostyka R2</span></>}
        lede="Czy panel ma komplet ustawień Cloudflare R2 i czy dane dostępowe pasują do bucketów"
        actions={<Link className="btn btn-primary" href="/system/r2?test=1" prefetch={false}>Sprawdź połączenie</Link>}
      />
      <div className="grid">
        <div className="span-7">
          <Card id="h-vars" title="Zmienne środowiska" sub="Sekrety pokazują tylko „ustawiona”.">
            <div className="checks">
              {d.variables.map((v) => (
                <Check key={v.name} kind={!v.present ? (v.required ? "crit" : "info") : v.problem ? "warn" : "ok"} title={<span className="mono">{v.name}</span>} sub={v.problem ?? (v.present ? (v.preview ?? "") : `${v.required ? "wymagana" : "opcjonalna"}: ${v.expected}`)} />
              ))}
            </div>
          </Card>
        </div>
        <div className="span-5">
          <Card id="h-conn" title="Połączenie z bucketami" meta={d.connection.checked ? <Badge kind={d.connection.buckets.every((b) => b.ok) ? "ok" : "crit"}>{d.connection.buckets.every((b) => b.ok) ? "wszystkie OK" : "są błędy"}</Badge> : <Badge kind="outline" icon={false}>nie sprawdzano</Badge>}>
            {!d.configured ? (
              <p className="muted">Najpierw uzupełnij zmienne{d.missingRequired.length ? `: brakuje ${d.missingRequired.join(", ")}` : ""}.</p>
            ) : !d.connection.checked ? (
              <p className="muted">Test wysyła jedno zapytanie HEAD do każdego bucketu (nic nie zapisuje). Uruchom przyciskiem „Sprawdź połączenie”.</p>
            ) : (
              <div className="checks">
                {d.connection.buckets.map((b) => (
                  <Check key={b.variable} kind={b.ok ? "ok" : "crit"} title={<span className="mono">{b.bucket}</span>} sub={b.ok ? b.message : `${b.message} ${b.hint ?? ""}`} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
