import type { Tx } from "@/lib/i18n/ui";

/**
 * The text a comment error is shown as. The API answers with a Polish `message` and a stable `code`; the message is
 * never shown, so a French or Chinese viewer does not read Polish (or a raw "Request failed with status 500").
 * The code decides, then a few HTTP statuses, and anything else shows the caller's translated `fallback`.
 */
export function commentErrorText(error: unknown, tx: Tx, fallback: string): string {
  const { code, status } = (typeof error === "object" && error !== null ? error : {}) as { code?: unknown; status?: unknown };
  switch (code) {
    case "AUTH_REQUIRED":
      return tx("Musisz być zalogowany, żeby komentować.", "You must be signed in to comment.");
    case "ONBOARDING_REQUIRED":
      return tx("Najpierw wybierz pseudonim w oknie powitalnym, potem możesz komentować.", "Choose a nickname in the welcome window first, then you can comment.");
    case "PASS_REQUIRED":
      return tx("Zostań patronem, aby komentować ten film.", "Become a patron to comment on this video."); // patron zone
    case "COMMENT_FORBIDDEN":
      return tx("Nie masz uprawnień do komentowania tego filmu.", "You don't have permission to comment on this video.");
    case "CHANNEL_BANNED":
      return tx("Nie możesz komentować filmów tego kanału.", "You can't comment on this channel's videos.");
    case "COMMENTS_DISABLED":
      return tx("Komentarze pod tym filmem są wyłączone.", "Comments on this video are turned off.");
    case "COMMENT_RATE_LIMITED":
      return tx("Zbyt dużo komentarzy. Spróbuj ponownie za chwilę.", "Too many comments. Try again in a moment.");
    case "COMMENT_VALIDATION_ERROR":
      return tx("Nieprawidłowe dane komentarza.", "Invalid comment data.");
    case "COMMENT_TOO_LONG":
    case "COMMENT_PAYLOAD_TOO_LARGE":
      return tx("Komentarz jest za długi.", "Comment is too long.");
    default:
      break;
  }
  if (status === 401) return tx("Musisz być zalogowany, żeby komentować.", "You must be signed in to comment.");
  if (status === 429) return tx("Zbyt dużo komentarzy. Spróbuj ponownie za chwilę.", "Too many comments. Try again in a moment.");
  return fallback;
}
