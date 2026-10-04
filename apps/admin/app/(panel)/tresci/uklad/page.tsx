import type { Metadata } from "next";
import Link from "next/link";
import { isUpcomingPremiere } from "@/lib/modules/video";
import { LayoutEditor } from "@admin/components/content/layout-editor";
import { Icon } from "@admin/components/icons";
import { Empty, PageHead } from "@admin/components/ui";
import { loadChannelLayout } from "@admin/lib/content";

export const metadata: Metadata = { title: "Układ kanału · Treści" };

export default async function ChannelLayoutPage() {
  const items = await loadChannelLayout();
  const now = new Date();
  return (
    <>
      <PageHead
        title="Układ kanału"
        lede="Kolejność opublikowanych filmów na liście (jak w serwisie, od góry), które są schowane i który jest na stronie głównej."
        crumbs={
          <>
            <Link href="/tresci">Treści</Link>
            <Icon name="right" />
            <span>Układ kanału</span>
          </>
        }
      />
      {items.length ? (
        <LayoutEditor
          initial={items.map((v) => ({ id: v.id, title: v.title, tier: v.tier, showInSidebar: v.showInSidebar, isMainFeatured: v.isMainFeatured, upcoming: isUpcomingPremiere({ status: "PUBLISHED", premiereAt: v.premiereAt }, now) }))}
        />
      ) : (
        <section className="card">
          <Empty icon="film" title="Nie ma opublikowanych filmów">
            Układ dotyczy tylko opublikowanych filmów.
          </Empty>
        </section>
      )}
    </>
  );
}
