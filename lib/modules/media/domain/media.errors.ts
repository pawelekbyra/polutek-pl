import { AppError } from "@/lib/modules/shared/app-error";

export class MediaSourceNotFoundError extends AppError {
  constructor(videoId: string) {
    super(`Media source for video ${videoId} not found`, 404, 'MEDIA_SOURCE_NOT_FOUND');
  }
}

export class UnsafePublicMediaDtoError extends AppError {
  constructor(reason: string) {
    super(`Public media DTO is unsafe: ${reason}`, 400, 'UNSAFE_PUBLIC_MEDIA_DTO');
  }
}

export class RawVideoUrlExposedError extends AppError {
  constructor() {
    super(`Raw video URL detected in public context`, 400, 'RAW_VIDEO_URL_EXPOSED');
  }
}

export class UnsupportedMediaProviderError extends AppError {
  constructor(provider: string) {
    super(`Media provider ${provider} is not supported`, 400, 'UNSUPPORTED_MEDIA_PROVIDER');
  }
}

export class InvalidMediaReferenceError extends AppError {
  constructor(videoId: string) {
    super(`Invalid media reference for video ${videoId}`, 400, 'INVALID_MEDIA_REFERENCE');
  }
}
