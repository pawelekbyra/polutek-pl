import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";

const WELCOME_EMAIL_SLUG = "welcome-email";

type EmailTemplateFallback = {
  subject: string;
  html: string;
  subjectEn?: string;
  htmlEn?: string;
};

type ResendSendResponse = {
  data?: { id?: string } | null;
  error?: unknown;
};

type ResendClient = {
  emails: {
    send(input: { from: string; to: string[]; subject: string; html: string }): Promise<ResendSendResponse>;
  };
};

const EMAIL_DICTIONARY: Record<string, EmailTemplateFallback> = {
  "account-deleted": {
    subject: `Twoje konto zostało usunięte - ${APP_NAME}`,
    html: "<h1>Potwierdzenie usunięcia konta</h1><p>Twoje dane zostały pomyślnie usunięte z naszego systemu.</p>",
    subjectEn: `Your account has been deleted - ${APP_NAME}`,
    htmlEn: "<h1>Account deletion confirmed</h1><p>Your data has been removed from our system.</p>",
  },
  "password-changed": {
    subject: `Hasło zostało zmienione - ${APP_NAME}`,
    html: "<h1>Bezpieczeństwo konta</h1><p>Twoje hasło zostało właśnie zaktualizowane.</p>",
    subjectEn: `Password changed - ${APP_NAME}`,
    htmlEn: "<h1>Account security</h1><p>Your password has been updated.</p>",
  },
  "thank-you-donation": {
    subject: `Dziękujemy za wsparcie! - ${APP_NAME}`,
    html: "<h1>Dziękujemy!</h1><p>Otrzymaliśmy Twoje wsparcie: {{amount}} {{currency}}.</p>",
    subjectEn: `Thank you for your support! - ${APP_NAME}`,
    htmlEn: "<h1>Thank you!</h1><p>We received your support: {{amount}} {{currency}}.</p>",
  },
  "become-patron": {
    subject: `Zostałeś Patronem! - ${APP_NAME}`,
    html: "<h1>Witaj w gronie Patronów!</h1><p>Dziękujemy za wsparcie: {{amount}} {{currency}}.</p>",
    subjectEn: `You are now a Patron! - ${APP_NAME}`,
    htmlEn: "<h1>Welcome to the Patrons!</h1><p>Thank you for your support: {{amount}} {{currency}}.</p>",
  },
};

let resendClient: ResendClient | null = null;

async function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is missing");
    const { Resend: Client } = await import("resend");
    resendClient = new Client(apiKey) as unknown as ResendClient;
  }
  return resendClient;
}

function replaceTemplateVariables(value: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (result, [key, replacement]) => result.split(`{{${key}}}`).join(replacement),
    value,
  );
}

type SendTemplateEmailInput = {
  to: string;
  slug: string;
  variables?: Record<string, string | null | undefined>;
  fallback?: EmailTemplateFallback;
  language?: string;
};

async function sendTemplateEmail({
  to,
  slug,
  variables = {},
  fallback,
  language = "pl",
}: SendTemplateEmailInput) {
  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
    select: { subject: true, html: true, subjectEn: true, htmlEn: true },
  });

  if (!template && !fallback) {
    throw new Error(`Email template with slug "${slug}" was not found and no fallback provided.`);
  }

  if (!template && fallback) {
    logger.warn(`[email] Using hardcoded fallback for template: ${slug}`);
  }

  const safeVariables = {
    ...Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, value ?? ""])),
    appName: APP_NAME,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    email: to,
    userLanguage: language,
    preferencesLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile/settings`,
  };

  let subjectBase = template?.subject ?? fallback!.subject;
  let htmlBase = template?.html ?? fallback!.html;

  if (language === "en") {
    subjectBase = template?.subjectEn || fallback?.subjectEn || subjectBase;
    htmlBase = template?.htmlEn || fallback?.htmlEn || htmlBase;
  }

  const resend = await getResendClient();
  const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;
  const subject = replaceTemplateVariables(subjectBase, safeVariables);
  const html = replaceTemplateVariables(htmlBase, safeVariables);
  const { data, error } = await resend.emails.send({ from, to: [to], subject, html });

  if (error) {
    logger.error(`[email] Failed to send "${slug}" email to ${to}:`, error);
    throw new Error(`Failed to send "${slug}" email: ${JSON.stringify(error)}`);
  }

  logger.info(`[email] Email "${slug}" sent successfully to ${to}. ID: ${data?.id}`);
  return data;
}

export async function sendWelcomeEmail(toEmail: string, firstName?: string | null, language: string = "pl") {
  const firstName_ = firstName || (language === "en" ? "User" : "Użytkowniku");
  return sendTemplateEmail({
    to: toEmail,
    slug: WELCOME_EMAIL_SLUG,
    variables: { firstName: firstName_ },
    fallback: {
      subject: language === "en" ? `Welcome to ${APP_NAME}, ${firstName_}!` : `Witaj w ${APP_NAME}, ${firstName_}!`,
      html: language === "en"
        ? `<p>Hi ${firstName_}, welcome to ${APP_NAME}.</p>`
        : `<p>Cześć ${firstName_}, witaj w ${APP_NAME}.</p>`,
    },
    language,
  });
}

export async function sendPasswordChangedEmail(toEmail: string) {
  return sendTemplateEmail({
    to: toEmail,
    slug: "password-changed",
    fallback: EMAIL_DICTIONARY["password-changed"],
  });
}

export async function sendAccountDeletedEmail(toEmail: string) {
  return sendTemplateEmail({
    to: toEmail,
    slug: "account-deleted",
    fallback: EMAIL_DICTIONARY["account-deleted"],
  });
}

export async function sendDonationThankYouEmail(toEmail: string, amount: number, currency: string, language?: string) {
  return sendTemplateEmail({
    to: toEmail,
    slug: "thank-you-donation",
    variables: { amount: amount.toFixed(2), currency },
    fallback: EMAIL_DICTIONARY["thank-you-donation"],
    language,
  });
}

export async function sendBecomePatronEmail(toEmail: string, amount: number, currency: string, language?: string) {
  return sendTemplateEmail({
    to: toEmail,
    slug: "become-patron",
    variables: { amount: amount.toFixed(2), currency },
    fallback: EMAIL_DICTIONARY["become-patron"],
    language,
  });
}
