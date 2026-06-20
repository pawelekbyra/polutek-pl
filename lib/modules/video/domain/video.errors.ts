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

export class InvalidPlaybackSessionError extends AppError {
  constructor() {
    super('Invalid playback session', 403, 'INVALID_SESSION');
  }
}

export class PlaybackSessionOwnershipMismatchError extends AppError {
  constructor() {
    super('Session user mismatch', 403, 'SESSION_USER_MISMATCH');
  }
}

export class PlaybackSessionAnonymousForbiddenError extends AppError {
  constructor() {
    super('Anonymous sessions are forbidden for this video', 403, 'SESSION_ANONYMOUS_FORBIDDEN');
  }
}

export class PlaybackSessionRequiresAuthError extends AppError {
  constructor() {
    super('This session requires authentication', 403, 'SESSION_REQUIRES_AUTH');
  }
}

export class PlaybackSessionFingerprintMismatchError extends AppError {
  constructor() {
    super('Session ownership mismatch', 403, 'SESSION_OWNERSHIP_MISMATCH');
  }
}

export class PlaybackSessionExpiredError extends AppError {
  constructor() {
    super('Session expired', 403, 'SESSION_EXPIRED');
  }
}

export class PlaybackSessionRequiredError extends AppError {
  constructor() {
    super('Session required for this event type', 400, 'SESSION_REQUIRED');
  }
}

export class InvalidPlaybackEventTypeError extends AppError {
  constructor() {
    super('Invalid event type', 400, 'INVALID_EVENT_TYPE');
  }
}

export class PlaybackAccessDeniedError extends AppError {
  constructor(reason?: string) {
    super(reason || 'Access denied', 403, 'ACCESS_DENIED');
  }
}


export class CloudflareConfigurationError extends AppError {
  public readonly missing: string[];

  constructor(missing: string[] = []) {
    super(
      'Cloudflare Stream nie jest skonfigurowany po stronie serwera. Skontaktuj się z administratorem technicznym przed uploadem nowych filmów.',
      503,
      'CLOUDFLARE_NOT_CONFIGURED'
    );
    this.name = 'CloudflareConfigurationError';
    this.missing = missing;
  }
}

export class CloudflareApiError extends AppError {
  constructor(message = 'Cloudflare Stream zwrócił błąd podczas przygotowania uploadu. Spróbuj ponownie później.') {
    super(message, 502, 'CLOUDFLARE_API_ERROR');
    this.name = 'CloudflareApiError';
  }
}

export class VideoNotReadyForPublicationError extends AppError {
  constructor(message = 'Film nie jest gotowy do publikacji. Wymagany jest primary asset Cloudflare Stream w stanie READY.') {
    super(message, 400, 'VIDEO_NOT_READY_FOR_PUBLICATION');
    this.name = 'VideoNotReadyForPublicationError';
  }
}
