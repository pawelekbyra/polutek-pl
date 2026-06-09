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
    attachments?: any[];
  };
};

export type ResendWebhookResult = {
  received: boolean;
  accepted: boolean;
  ignored?: boolean;
  duplicate?: boolean;
  idempotency?: "available" | "not_available";
};
