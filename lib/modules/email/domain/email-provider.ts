/** What the email transport reports back (provider-neutral). */
export type EmailSendError = {
  name?: string;
  message: string;
  statusCode?: number | null;
  /** Plain Polish hint for the operator (admin screens, test script); never contains secrets. */
  hint?: string;
};
export type EmailSendResult = { ok: true; id: string | null } | { ok: false; error: EmailSendError };
