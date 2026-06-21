import { AppError } from "@/lib/modules/shared/app-error";

export class PaymentError extends AppError {
  constructor(message: string, code = 'PAYMENT_ERROR', status = 400) {
    super(message, status, code);
    this.name = 'PaymentError';
  }
}

export class PaymentWebhookSignatureError extends PaymentError {
  constructor(message: string) {
    super(message, 'PAYMENT_WEBHOOK_SIGNATURE_ERROR', 400);
    this.name = 'PaymentWebhookSignatureError';
  }
}

export class PaymentWebhookConfigError extends PaymentError {
  constructor(message: string) {
    super(message, 'PAYMENT_WEBHOOK_CONFIG_ERROR', 500);
    this.name = 'PaymentWebhookConfigError';
  }
}

export class PaymentWebhookProcessingError extends PaymentError {
  constructor(message: string) {
    super(message, 'PAYMENT_WEBHOOK_PROCESSING_ERROR', 500);
    this.name = 'PaymentWebhookProcessingError';
  }
}

export class UserNotFoundError extends PaymentError {
  constructor(userId: string) {
    super(`User ${userId} was not found.`, 'USER_NOT_FOUND', 404);
    this.name = 'UserNotFoundError';
  }
}

export class InvalidPaymentRequestError extends PaymentError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_PAYMENT_REQUEST', 400);
    this.name = 'InvalidPaymentRequestError';
    (this as any).details = details;
  }
}

export class PaymentProviderError extends PaymentError {
  constructor(message: string) {
    super(message, 'PAYMENT_PROVIDER_ERROR', 502);
    this.name = 'PaymentProviderError';
  }
}
