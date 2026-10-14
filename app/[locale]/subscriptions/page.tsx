import MySubscriptionsView, {
  mySubscriptionsMetadata,
  type MySubscriptionsPageProps,
} from "@/app/components/subscriptions/MySubscriptionsView";

export const dynamic = "force-dynamic";

export function generateMetadata(props: MySubscriptionsPageProps) {
  return mySubscriptionsMetadata(props);
}

export default function MySubscriptionsPage(props: MySubscriptionsPageProps) {
  return <MySubscriptionsView {...props} />;
}
