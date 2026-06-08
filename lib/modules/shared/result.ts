import { AppError } from "./app-error";

export type UseCaseResult<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function ok<T>(data: T): UseCaseResult<T, never> {
  return { ok: true, data };
}

export function fail<E>(error: E): UseCaseResult<never, E> {
  return { ok: false, error };
}
