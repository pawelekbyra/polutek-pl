import { AppError } from "../../shared/app-error";

export class EmailError extends AppError {
  constructor(message: string, statusCode: number = 400, code?: string) {
    super(message, statusCode, code);
    this.name = 'EmailError';
  }
}

export class InvalidBroadcastPayloadError extends EmailError {
  constructor(message: string = 'Invalid broadcast payload') {
    super(message, 400, 'INVALID_BROADCAST_PAYLOAD');
  }
}

export class EmailProviderError extends EmailError {
  constructor(message: string = 'Email provider failure') {
    super(message, 502, 'EMAIL_PROVIDER_FAILURE');
  }
}
