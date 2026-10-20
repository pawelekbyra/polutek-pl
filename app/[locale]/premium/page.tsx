// experiment: premium-pass (docs/experiments/premium-pass.md): thin route, the page lives in app/components/premium-pass.
import PassOfferPage, { passOfferMetadata, type PassOfferPageProps } from "@/app/components/premium-pass/PassOfferPage";

export const dynamic = "force-dynamic";

export function generateMetadata(props: PassOfferPageProps) {
  return passOfferMetadata(props);
}

export default function Page(props: PassOfferPageProps) {
  return <PassOfferPage {...props} />;
}
