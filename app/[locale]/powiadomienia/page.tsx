import NotificationCenterPage, {
  notificationCenterMetadata,
  type NotificationCenterPageProps,
} from "@/app/components/notifications/NotificationCenterPage";

export const dynamic = "force-dynamic";

export function generateMetadata(props: NotificationCenterPageProps) {
  return notificationCenterMetadata(props);
}

export default function PowiadomieniaPage(props: NotificationCenterPageProps) {
  return <NotificationCenterPage {...props} />;
}
