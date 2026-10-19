import SectionPage, { type SectionPageProps } from "@/app/components/sections/SectionPage";

export const dynamic = "force-dynamic";

export default function PhotosPage(props: SectionPageProps) {
  return <SectionPage {...props} section="photos" polishAddress={false} />;
}
