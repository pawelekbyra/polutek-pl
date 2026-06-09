import { EmailProvider } from "../domain/email-provider";
import { EmailService } from "@/lib/services/email.service";
import { Resend } from "resend";
import { APP_NAME } from "@/lib/constants";
import { logger } from "@/lib/logger";

/**
 * R9 legacy email bridge.
 * Adapts the legacy EmailService to the new EmailProvider interface.
 */
export class LegacyEmailServiceProvider implements EmailProvider {
  private resendClient: Resend | null = null;

  private getResendClient() {
    if (!this.resendClient) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error('RESEND_API_KEY is missing');
      }
      this.resendClient = new Resend(apiKey);
    }
    return this.resendClient;
  }

  async sendBroadcast(input: {
    subject: string;
    body: string;
    recipients: Array<{ email: string; name?: string | null; language: string }>;
    broadcastId: string;
  }) {
    // Note: Legacy EmailService.sendBroadcast takes ONLY broadcastId.
    // It reads subject/body from DB based on broadcastId.
    await EmailService.sendBroadcast(input.broadcastId);

    return {
      sent: input.recipients.length,
      failed: 0,
      messageIds: [],
    };
  }

  async sendTestEmail(input: { to: string; subject: string; body: string }) {
    try {
      const resend = this.getResendClient();
      const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;

      const { data, error } = await resend.emails.send({
        from,
        to: [input.to],
        subject: `[TEST] ${input.subject}`,
        html: input.body
      });

      if (error) throw error;

      return { messageId: data?.id || "unknown-id" };
    } catch (error) {
      logger.error("[LegacyEmailServiceProvider] Failed to send test email", error);
      throw error;
    }
  }
}
