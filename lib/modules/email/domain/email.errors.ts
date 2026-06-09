import { AppError } from "../../shared/app-error";

export class EmailError extends AppError {
  constructor(message: string, statusCode: number = 400, code?: string) {
    super(message, statusCode, code);
    this.name = 'EmailError';
  }
}

export class InvalidBroadcastPayloadError extends EmailError {
  constructor(message: string = 'Invalid broadcast payload') {
    super(message, 400, 'EMAIL_INVALID_PAYLOAD');
  }
}

export class InvalidBroadcastAudienceError extends EmailError {
  constructor(message: string = 'Invalid broadcast audience') {
    super(message, 400, 'EMAIL_INVALID_AUDIENCE');
  }
}

export class TestRecipientRequiredError extends EmailError {
  constructor(message: string = 'Test recipient email is required for TEST audience') {
    super(message, 400, 'EMAIL_TEST_RECIPIENT_REQUIRED');
  }
}

export class NoRecipientsError extends EmailError {
  constructor(message: string = 'No recipients found for this audience') {
    super(message, 400, 'EMAIL_NO_RECIPIENTS');
  }
}

export class EmailProviderError extends EmailError {
  constructor(message: string = 'Email provider failure') {
    super(message, 502, 'EMAIL_PROVIDER_FAILED');
  }
}

export class WebhookInvalidPayloadError extends EmailError {
  constructor(message: string = 'Invalid webhook payload') {
    super(message, 400, 'EMAIL_WEBHOOK_INVALID_PAYLOAD');
  }
}

export class WebhookUnsupportedEventError extends EmailError {
  constructor(message: string = 'Unsupported webhook event type') {
    super(message, 202, 'EMAIL_WEBHOOK_UNSUPPORTED_EVENT');
  }
}
