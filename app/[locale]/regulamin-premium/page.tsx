// experiment: premium-pass (docs/experiments/premium-pass.md): thin route, the page lives in app/components/premium-pass.
import PassTermsPage, { passTermsMetadata, type PassTermsPageProps } from "@/app/components/premium-pass/PassTermsPage";

export const dynamic = "force-dynamic";

export function generateMetadata(props: PassTermsPageProps) {
  return passTermsMetadata(props);
}

export default function Page(props: PassTermsPageProps) {
  return <PassTermsPage {...props} expected="pl" />;
}
