export {
  resolveEmailLanguage,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountDeletedEmail,
  sendDonationThankYouEmail,
  sendBecomePatronEmail,
} from "./application/send-transactional-email.use-case";
export type { EmailLanguage } from "./application/send-transactional-email.use-case";
export { handleResendWebhook } from "./application/handle-resend-webhook.use-case";
export { verifyResendWebhook } from "./infrastructure/resend-webhook-verifier";
export type { ResendWebhookVerification } from "./infrastructure/resend-webhook-verifier";
export {
  listEmailTemplates,
  getEmailTemplateBySlug,
  upsertEmailTemplate,
  deleteEmailTemplate,
  getCustomTemplateVariables,
} from "./application/email-templates.use-cases";
export {
  countBroadcastAudience,
  createBroadcast,
  sendBroadcastTest,
  cancelBroadcast,
  listAdminBroadcastEmails,
} from "./application/broadcasts.use-cases";
export { processBroadcastQueue } from "./application/process-broadcast-queue";
export type { BroadcastRunResult } from "./application/process-broadcast-queue";
export { BroadcastQueueRepository } from "./infrastructure/broadcast-queue.repository";
export type {
  AdminBroadcastEmailListItemDto,
  CreateBroadcastInput,
  CreateBroadcastResult,
  SendBroadcastTestInput,
  ResendWebhookInput,
  ResendWebhookResult,
  EmailTemplateDto,
  UpsertEmailTemplateInput,
} from "./domain/email.dto";
export * from "./domain/email.errors";
