import { Resend } from "resend";
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";
import type { PreparedEmail } from "./email.transport";

/** Resend adapter (EMAIL_PROVIDER=resend, the default). Receives a fully prepared message from email.transport.ts. */

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is missing');
  return new Resend(apiKey);
}

function toSendError(error: unknown): EmailSendError {
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; message?: unknown; statusCode?: unknown };
    return {
      name: typeof e.name === 'string' ? e.name : undefined,
      message: typeof e.message === 'string' ? e.message : 'Unknown email provider error',
      statusCode: typeof e.statusCode === 'number' ? e.statusCode : null,
    };
  }
  return { message: String(error) };
}

export async function sendViaResend(mail: PreparedEmail): Promise<EmailSendResult> {
  try {
    const { data, error } = await getResendClient().emails.send(
      {
        from: mail.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: mail.replyTo,
        headers: mail.headers,
        tags: mail.tags,
      },
      mail.idempotencyKey ? { idempotencyKey: mail.idempotencyKey } : undefined,
    );
    if (error) return { ok: false, error: toSendError(error) };
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    return { ok: false, error: toSendError(error) };
  }
}
