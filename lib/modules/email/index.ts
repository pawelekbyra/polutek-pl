export {
  resolveEmailLanguage,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendChangeEmailConfirmationEmail,
  sendChangeEmailVerificationEmail,
  sendEmailChangedEmail,
  sendAccountDeletedEmail,
  sendDonationThankYouEmail,
  sendBecomePatronEmail,
} from "./application/send-transactional-email.use-case";
export type { EmailLanguage } from "./application/send-transactional-email.use-case";
export { sendOperatorEmail } from "./application/send-operator-email";
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
export { processBroadcastQueue, runBroadcastQueue } from "./application/process-broadcast-queue";
export type { BroadcastRunResult } from "./application/process-broadcast-queue";
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
