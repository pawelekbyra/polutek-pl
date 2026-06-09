export type AdminBroadcastEmailInput = {
  subjectPl: string;
  htmlPl: string;
  subjectEn: string;
  htmlEn: string;
  recipientGroup?: 'ALL' | 'SUBSCRIBERS' | 'PATRONS' | 'MANUAL';
  isTest?: boolean;
  testEmail?: string | null;
  manualEmails?: string | null;
};

export type AdminBroadcastEmailResult = {
  success: boolean;
  broadcastId?: string;
  recipientCount: number;
  message?: string;
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
};
