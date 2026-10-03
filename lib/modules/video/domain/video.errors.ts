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
  constructor(message = 'Hero video must be public, published, non-archived and backed by a READY own HLS asset.') {
    super(message, 400, 'VIDEO_INVALID_HERO');
  }
}

export class VideoInvalidSidebarError extends AppError {
  constructor(message = 'Only published, non-archived videos can be shown in the public sidebar.') {
    super(message, 400, 'VIDEO_INVALID_SIDEBAR');
  }
}

export class VideoInvalidPremiereError extends AppError {
  constructor(message = 'Data premiery musi być w przyszłości.') {
    super(message, 400, 'VIDEO_INVALID_PREMIERE');
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


export class VideoNotReadyForPublicationError extends AppError {
  constructor(message = 'Film nie jest gotowy do publikacji. Wymagany jest gotowy (READY) zakodowany materiał własnego HLS.', code = 'VIDEO_NOT_READY_FOR_PUBLICATION') {
    super(message, 400, code);
    this.name = 'VideoNotReadyForPublicationError';
  }
}
