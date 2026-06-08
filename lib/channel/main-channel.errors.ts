export class MainChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainChannelError';
  }
}

export class MainChannelNotFoundError extends MainChannelError {
  constructor(slug: string) {
    super(`Main channel with slug "${slug}" not found in database.`);
    this.name = 'MainChannelNotFoundError';
  }
}

export class MainChannelNotApprovedError extends MainChannelError {
  constructor(slug: string) {
    super(`Main channel "${slug}" exists but is not approved.`);
    this.name = 'MainChannelNotApprovedError';
  }
}

export class MainChannelNotPrimaryError extends MainChannelError {
  constructor(slug: string) {
    super(`Main channel "${slug}" exists but is not marked as primary.`);
    this.name = 'MainChannelNotPrimaryError';
  }
}

export class AmbiguousMainChannelSetupError extends MainChannelError {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousMainChannelSetupError';
  }
}
