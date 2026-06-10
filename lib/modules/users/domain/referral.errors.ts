import { AppError } from "@/lib/modules/shared/app-error";

export class ReferralError extends AppError {
  constructor(message: string, statusCode: number = 400, code: string = "REFERRAL_ERROR") {
    super(message, statusCode, code);
  }
}

export class SelfReferralError extends ReferralError {
  constructor() {
    super("Self-referral is not allowed", 400, "SELF_REFERRAL_NOT_ALLOWED");
  }
}

export class UserAlreadyReferredError extends ReferralError {
  constructor() {
    super("User already referred", 409, "USER_ALREADY_REFERRED");
  }
}

export class ReferredUserNotFoundError extends ReferralError {
  constructor() {
    super("Referred user not found", 404, "REFERRED_USER_NOT_FOUND");
  }
}

export class InvalidReferralCodeError extends ReferralError {
  constructor() {
    super("Invalid referral code", 404, "INVALID_REFERRAL_CODE");
  }
}
