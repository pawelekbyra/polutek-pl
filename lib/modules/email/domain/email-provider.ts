export type EmailProvider = {
  sendBroadcast(input: {
    subject: string;
    body: string;
    recipients: Array<{ email: string; name?: string | null; language: string }>;
    broadcastId: string;
  }): Promise<{
    sent: number;
    failed: number;
    messageIds: string[];
    failures?: Array<{ email: string; reason: string }>;
  }>;

  sendTestEmail(input: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string }>;
};
