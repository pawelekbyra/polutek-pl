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
export { handleSesEvent, normalizeSesEvent } from "./application/handle-ses-event.use-case";
export { verifySnsMessage, isAllowedSnsUrl } from "./infrastructure/sns-verifier";
export type { SnsMessage, SnsVerification } from "./infrastructure/sns-verifier";
export { sendOperatorEmail } from "./application/send-operator-email";
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
  EmailTemplateDto,
  UpsertEmailTemplateInput,
} from "./domain/email.dto";
export { getEmailTemplateDefault, previewEmailTemplate, getDeliverability, getSuppressions, emailLimits } from "./application/admin-communication";
export type { TemplatePreview, Deliverability, SuppressionView } from "./application/admin-communication";
export { findPlaceholders } from "./domain/render-email";
export * from "./domain/email.errors";
