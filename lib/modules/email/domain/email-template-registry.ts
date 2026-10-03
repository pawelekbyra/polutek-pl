import { SYSTEM_TEMPLATE_SLUGS, type SystemTemplateSlug } from "@/lib/email-defaults";

/**
 * The one definition of which variables each kind of email has. The sender fills exactly these,
 * the admin editor offers exactly these, and saving a template that uses anything else is refused.
 */

export type EmailVariableDefinition = {
  key: string;
  label: string;
  /** Example value used by the admin preview. */
  sample: { pl: string; en: string };
};

const VARIABLES = {
  firstName: { key: "firstName", label: "Pseudonim odbiorcy", sample: { pl: "Jan", en: "John" } },
  email: { key: "email", label: "E-mail odbiorcy", sample: { pl: "jan@example.com", en: "john@example.com" } },
  appName: { key: "appName", label: "Adres serwisu", sample: { pl: "www.pawelperfect.com", en: "www.pawelperfect.com" } },
  brandName: { key: "brandName", label: "Nazwa marki (tematy i treść)", sample: { pl: "Pawel Perfect", en: "Pawel Perfect" } },
  appUrl: { key: "appUrl", label: "URL serwisu", sample: { pl: "https://www.pawelperfect.com", en: "https://www.pawelperfect.com" } },
  actionUrl: { key: "actionUrl", label: "Link akcji (potwierdzenie / reset)", sample: { pl: "https://www.pawelperfect.com/api/auth/verify-email?token=…", en: "https://www.pawelperfect.com/api/auth/verify-email?token=…" } },
  amount: { key: "amount", label: "Kwota", sample: { pl: "20.00", en: "5.00" } },
  currency: { key: "currency", label: "Waluta", sample: { pl: "PLN", en: "EUR" } },
  preferencesLink: { key: "preferencesLink", label: "Link wypisu z powiadomień", sample: { pl: "https://www.pawelperfect.com/unsubscribe?token=…", en: "https://www.pawelperfect.com/unsubscribe?token=…" } },
  unsubscribeLink: { key: "unsubscribeLink", label: "Link wypisu z powiadomień", sample: { pl: "https://www.pawelperfect.com/unsubscribe?token=…", en: "https://www.pawelperfect.com/unsubscribe?token=…" } },
} satisfies Record<string, EmailVariableDefinition>;

export type EmailVariableKey = keyof typeof VARIABLES;

const COMMON: EmailVariableKey[] = ["firstName", "email", "appName", "brandName", "appUrl"];

export type EmailTemplateDefinition = {
  slug: string;
  name: string;
  description: string;
  variables: EmailVariableKey[];
  /** Variables the template must contain (a verification mail without its link is useless). */
  required: EmailVariableKey[];
  /**
   * Whether the mail carries the content-notification unsubscribe link and List-Unsubscribe headers.
   * Security and payment mails never do.
   */
  unsubscribe: boolean;
};

export const SYSTEM_TEMPLATE_DEFINITIONS: Record<SystemTemplateSlug, EmailTemplateDefinition> = {
  "welcome-email": {
    slug: "welcome-email",
    name: "Powitanie",
    description: "Po pierwszym logowaniu (raz, po wybraniu pseudonimu).",
    variables: [...COMMON, "preferencesLink"],
    required: [],
    unsubscribe: true,
  },
  "become-patron": {
    slug: "become-patron",
    name: "Podziękowanie za napiwek (próg)",
    description: "Po pierwszym napiwku, który osiągnął próg w ustawieniach płatności.",
    variables: [...COMMON, "amount", "currency"],
    required: [],
    unsubscribe: false,
  },
  "thank-you-donation": {
    slug: "thank-you-donation",
    name: "Podziękowanie za napiwek",
    description: "Po napiwku poniżej progu w ustawieniach płatności.",
    variables: [...COMMON, "amount", "currency"],
    required: [],
    unsubscribe: false,
  },
  "password-changed": {
    slug: "password-changed",
    name: "Hasło zmienione",
    description: "Po zmianie lub resecie hasła (bezpieczeństwo konta).",
    variables: COMMON,
    required: [],
    unsubscribe: false,
  },
  "account-deleted": {
    slug: "account-deleted",
    name: "Konto usunięte",
    description: "Potwierdzenie usunięcia konta.",
    variables: COMMON,
    required: [],
    unsubscribe: false,
  },
  "verify-email": {
    slug: "verify-email",
    name: "Potwierdzenie e-maila",
    description: "Link potwierdzający adres po rejestracji lub zmianie adresu.",
    variables: [...COMMON, "actionUrl"],
    required: ["actionUrl"],
    unsubscribe: false,
  },
  "reset-password": {
    slug: "reset-password",
    name: "Reset hasła",
    description: "Link do ustawienia nowego hasła.",
    variables: [...COMMON, "actionUrl"],
    required: ["actionUrl"],
    unsubscribe: false,
  },
};

/**
 * Admin-made templates are starting points for broadcasts, so they get the broadcast variables.
 * The broadcast footer with the unsubscribe link is added by the sender anyway.
 */
export const BROADCAST_TEMPLATE_DEFINITION: EmailTemplateDefinition = {
  slug: "broadcast",
  name: "Rozsyłka",
  description: "Wiadomość do osób, które włączyły powiadomienia o nowych treściach.",
  variables: [...COMMON, "unsubscribeLink", "preferencesLink"],
  required: [],
  unsubscribe: true,
};

export function isSystemTemplateSlug(slug: string): slug is SystemTemplateSlug {
  return (SYSTEM_TEMPLATE_SLUGS as readonly string[]).includes(slug);
}

export function getTemplateDefinition(slug: string): EmailTemplateDefinition {
  return isSystemTemplateSlug(slug) ? SYSTEM_TEMPLATE_DEFINITIONS[slug] : BROADCAST_TEMPLATE_DEFINITION;
}

export function describeVariables(definition: EmailTemplateDefinition): EmailVariableDefinition[] {
  return definition.variables.map((key) => VARIABLES[key]);
}
