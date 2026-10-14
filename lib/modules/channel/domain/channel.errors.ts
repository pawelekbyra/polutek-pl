import { AppError } from "@/lib/modules/shared/app-error";

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
    super(`Main channel "${slug}" exists but is not publicly visible.`, 403, 'CHANNEL_NOT_APPROVED');
    this.name = 'MainChannelNotApprovedError';
  }
}

export class ChannelNotFoundError extends MainChannelError {
  constructor(id: string) {
    super(`Channel "${id}" not found.`, 404, 'CHANNEL_NOT_FOUND');
    this.name = 'ChannelNotFoundError';
  }
}
