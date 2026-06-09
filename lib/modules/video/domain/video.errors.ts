import { AppError } from "@/lib/modules/shared/app-error";

export class VideoNotFoundError extends AppError {
  constructor(id: string) {
    super(`Video ${id} not found`, 404, 'VIDEO_NOT_FOUND');
  }
}

export class VideoNotOnMainChannelError extends AppError {
  constructor(id: string) {
    super(`Video ${id} does not belong to main channel`, 403, 'VIDEO_NOT_ON_MAIN_CHANNEL');
  }
}

export class VideoSlugConflictError extends AppError {
  constructor(slug: string) {
    super(`Video slug ${slug} is already in use`, 409, 'VIDEO_SLUG_CONFLICT');
  }
}

export class VideoInvalidHeroError extends AppError {
  constructor() {
    super(`Only public and published videos can be set as hero`, 400, 'VIDEO_INVALID_HERO');
  }
}

export class VideoUrlNotAllowedError extends AppError {
  constructor(url: string) {
    super(`Video URL ${url} is not allowed by media policy`, 400, 'VIDEO_URL_NOT_ALLOWED');
  }
}
