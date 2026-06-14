export type BroadcastAudience =
  | "ALL_SUBSCRIBERS"
  | "PATRONS"
  | "NON_PATRONS"
  | "TEST"
  | "MANUAL";

export type AdminBroadcastEmailInput = {
  subject: string;
  body: string; // Used for content if not using templates
  audience: BroadcastAudience;
  testRecipientEmail?: string | null;
  manualRecipients?: Array<{
    email: string;
    name?: string | null;
  }>;
  dryRun?: boolean;
  requestedByAdminId?: string;
  // Legacy fields to be mapped for backward compatibility if needed
  subjectPl?: string;
  htmlPl?: string;
  subjectEn?: string;
  htmlEn?: string;
  manualEmails?: string | null;
};

export type BroadcastRecipientDto = {
  userId?: string | null;
  email: string;
  name?: string | null;
  isPatron?: boolean;
  language: string;
};

export type AdminBroadcastEmailResult = {
  dryRun: boolean;
  audience: BroadcastAudience;
  recipientCount: number;
  sent: number;
  skipped: number;
  failed: number;
  broadcastId?: string;
  messageIds: string[];
  failures?: Array<{
    email: string;
    reason: string;
  }>;
  message?: string;
};

export type AdminBroadcastEmailListItemDto = {
  id: string;
  subjectPl: string;
  status: string;
  recipientGroup: string;
  recipientCount: number;
  sentCount: number;
  errorCount: number;
  sentAt: Date | null;
  createdAt: Date;
  createdById: string | null;
};

export type ResendWebhookInput = {
  eventId?: string; // Internal or provider event ID
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    status?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    attachments?:
Array<
any>;
  };
};

export type ResendWebhookResult = {
  received: boolean;
  accepted: boolean;
  ignored?: boolean;
  duplicate?: boolean;
  idempotency?: "available" | "not_available" | "best_effort";
};

export type InboundEmailDto = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  resendId: string;
  status: "NEW" | "READ" | "ARCHIVED" | "RESOLVED";
  userId: string | null;
  broadcastEmailId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateInboundEmailInput = {
  id: string;
  status: "NEW" | "READ" | "ARCHIVED" | "RESOLVED";
};

export type EmailTemplateDto = {
  id: string;
  slug: string;
  name: string | null;
  description: string | null;
  category: "SYSTEM" | "WELCOME" | "PAYMENT" | "PATRON" | "BROADCAST" | "MANUAL" | "OTHER";
  isSystem: boolean;
  isActive: boolean;
  subject: string;
  html: string;
  subjectEn: string | null;
  htmlEn: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertEmailTemplateInput = {
  slug: string;
  name?: string | null;
  description?: string | null;
  category?: "SYSTEM" | "WELCOME" | "PAYMENT" | "PATRON" | "BROADCAST" | "MANUAL" | "OTHER";
  isActive?: boolean;
  subject: string;
  html: string;
  subjectEn?: string | null;
  htmlEn?: string | null;
};
