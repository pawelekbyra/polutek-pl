import { AppError } from "@/lib/errors";

export class MainChannelError extends AppError {
  constructor(message: string, statusCode: number = 400, code: string = 'CHANNEL_ERROR') {
    super(message, statusCode, code);
    this.name = 'MainChannelError';
  }
}

export class MainChannelNotFoundError extends MainChannelError {
  constructor(slug: string) {
    super(`Main channel with slug "${slug}" not found in database.`, 404, 'CHANNEL_NOT_FOUND');
    this.name = 'MainChannelNotFoundError';
  }
}

export class MainChannelNotApprovedError extends MainChannelError {
  constructor(slug: string) {
    super(`Main channel "${slug}" exists but is not approved.`, 403, 'CHANNEL_NOT_APPROVED');
    this.name = 'MainChannelNotApprovedError';
  }
}

export class MainChannelNotPrimaryError extends MainChannelError {
  constructor(slug: string) {
    super(`Main channel "${slug}" exists but is not marked as primary.`, 403, 'CHANNEL_NOT_PRIMARY');
    this.name = 'MainChannelNotPrimaryError';
  }
}
