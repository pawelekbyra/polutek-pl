import { NotificationDTO } from "../types/notification";

/**
 * Temporary mock feed for NotificationsMenu. Replace with a real fetch
 * (e.g. a lib/modules/notifications read model) once a notifications
 * backend exists — the component only depends on NotificationDTO[].
 */
export function getMockNotifications(): NotificationDTO[] {
  return [
    {
      id: "support-invite",
      kind: "support",
      titlePl: "Dołącz do Strefy Fenkju",
      titleEn: "Join the Thank You Zone",
      bodyPl: "Jednorazowe wsparcie kanału odblokowuje dożywotni dostęp do Strefy Fenkju — materiałów dostępnych tylko dla patronów.",
      bodyEn: "A one-time tip unlocks lifetime access to the Thank You Zone — content available only to patrons.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      read: false,
      href: null,
    },
    {
      id: "welcome",
      kind: "welcome",
      titlePl: "Witamy na Polutku!",
      titleEn: "Welcome to Polutek!",
      bodyPl: "Cieszymy się, że tu jesteś. Oglądaj najnowsze odcinki i dołącz do rozmowy w komentarzach.",
      bodyEn: "We're glad you're here. Watch the latest episodes and join the conversation in the comments.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      read: false,
      href: null,
    },
  ];
}
