export type AdminApiErrorPayload = {
  message?: unknown;
  error?: unknown;
} | null | undefined;

export function readAdminApiError(payload: AdminApiErrorPayload, fallback: string): string {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  const error = payload?.error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const nestedMessage = (error as { message?: unknown }).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
