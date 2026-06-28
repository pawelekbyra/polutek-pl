import { EmailService } from "@/lib/services/email.service";

export async function sendWelcomeEmail(
  toEmail: string,
  firstName?: string | null,
  language: string = "pl",
) {
  return EmailService.sendWelcomeEmail(toEmail, firstName, language);
}

export async function sendPasswordChangedEmail(toEmail: string) {
  return EmailService.sendPasswordChangedEmail(toEmail);
}

export async function sendAccountDeletedEmail(toEmail: string) {
  return EmailService.sendAccountDeletedEmail(toEmail);
}

export async function sendDonationThankYouEmail(
  toEmail: string,
  amount: number,
  currency: string,
  language?: string,
) {
  return EmailService.sendDonationThankYouEmail(toEmail, amount, currency, language);
}

export async function sendBecomePatronEmail(
  toEmail: string,
  amount: number,
  currency: string,
  language?: string,
) {
  return EmailService.sendBecomePatronEmail(toEmail, amount, currency, language);
}
