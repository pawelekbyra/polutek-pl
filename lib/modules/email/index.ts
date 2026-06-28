export { sendAdminBroadcastEmail } from "./application/send-admin-broadcast-email.use-case";
export {
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendAccountDeletedEmail,
  sendDonationThankYouEmail,
  sendBecomePatronEmail,
} from "./application/send-transactional-email.use-case";
export { handleResendWebhook } from "./application/handle-resend-webhook.use-case";
export { listAdminBroadcastEmails } from "./application/list-admin-broadcast-emails.use-case";
export { listInboundEmails } from "./application/list-inbound-emails.use-case";
export { updateInboundEmail } from "./application/update-inbound-email.use-case";
export { listEmailTemplates } from "./application/list-email-templates.use-case";
export { getEmailTemplateBySlug } from "./application/get-email-template.use-case";
export { upsertEmailTemplate } from "./application/upsert-email-template.use-case";
export { deleteEmailTemplate } from "./application/delete-email-template.use-case";
export type {
  AdminBroadcastEmailInput,
  AdminBroadcastEmailResult,
  AdminBroadcastEmailListItemDto,
  ResendWebhookInput,
  ResendWebhookResult,
  BroadcastAudience,
  InboundEmailDto,
  UpdateInboundEmailInput,
  EmailTemplateDto,
  UpsertEmailTemplateInput,
} from "./domain/email.dto";
export * from "./domain/email.errors";
