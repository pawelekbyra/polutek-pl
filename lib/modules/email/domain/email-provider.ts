/** What the email transport reports back (provider-neutral). */
export type EmailSendError = { name?: string; message: string; statusCode?: number | null };
export type EmailSendResult = { ok: true; id: string | null } | { ok: false; error: EmailSendError };
