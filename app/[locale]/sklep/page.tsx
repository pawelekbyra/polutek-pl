import SectionPage, { type SectionPageProps } from "@/app/components/sections/SectionPage";

export const dynamic = "force-dynamic";

export default function ShopPage(props: SectionPageProps) {
  return <SectionPage {...props} section="shop" polishAddress={true} />;
}
