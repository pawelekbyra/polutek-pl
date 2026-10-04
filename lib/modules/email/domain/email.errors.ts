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

export class NoRecipientsError extends EmailError {
  constructor(message: string = 'Nikt nie ma włączonych powiadomień o nowych treściach, więc nie ma do kogo wysłać.') {
    super(message, 400, 'EMAIL_NO_RECIPIENTS');
  }
}

export class BroadcastInProgressError extends EmailError {
  constructor() {
    super('Poprzednia rozsyłka jeszcze trwa. Poczekaj na jej koniec albo ją anuluj w historii.', 409, 'EMAIL_BROADCAST_IN_PROGRESS');
  }
}

export class BroadcastNotFoundError extends EmailError {
  constructor() {
    super('Nie ma takiej rozsyłki.', 404, 'EMAIL_BROADCAST_NOT_FOUND');
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

export class EmailTemplateNotFoundError extends EmailError {
  constructor(slug: string) {
    super(`Email template with slug '${slug}' not found`, 404, 'EMAIL_TEMPLATE_NOT_FOUND');
  }
}

export class InvalidTemplateVariablesError extends EmailError {
  readonly unknown: string[];
  readonly missingRequired: string[];

  constructor(problems: { unknown: string[]; missingRequired: string[] }) {
    const parts = [
      problems.unknown.length ? `nieznane zmienne: ${problems.unknown.map((k) => `{{${k}}}`).join(', ')}` : '',
      problems.missingRequired.length ? `brak wymaganych zmiennych: ${problems.missingRequired.map((k) => `{{${k}}}`).join(', ')}` : '',
    ].filter(Boolean);
    super(`Szablon ma błędne zmienne (${parts.join('; ')}).`, 400, 'EMAIL_TEMPLATE_INVALID_VARIABLES');
    this.unknown = problems.unknown;
    this.missingRequired = problems.missingRequired;
  }
}
