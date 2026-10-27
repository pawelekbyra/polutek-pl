import type { Tx } from "@/lib/i18n/ui";
import { PLAYLISTS_PER_CHANNEL_MAX, PLAYLIST_ITEMS_MAX } from "@/lib/modules/playlists/domain/playlist-rules";
import { StudioApiError } from "./studio-client";

/**
 * The text a Studio error is shown as. The API answers with a Polish `error` message plus a stable `code`; showing
 * that message would put Polish into every other language, so the viewer sees a text keyed by the code (then by
 * the HTTP status), in the interface language. A code this map does not know shows the caller's translated
 * `fallback`; only the Polish interface may show the server's own Polish message, because for it nothing is lost.
 * Moderators' free-text reasons are data, not errors, and never pass through here.
 */
export function studioErrorText(error: unknown, tx: Tx, fallback: string): string {
  if (!(error instanceof StudioApiError)) return fallback;
  return (
    byCode(error.code, tx) ??
    byPrefix(error.code, tx) ??
    byStatus(error.status, tx) ??
    (tx.language === "pl" && error.message ? error.message : fallback)
  );
}

function byCode(code: string | undefined, tx: Tx): string | null {
  switch (code) {
    case "UNAUTHORIZED":
    case "UNAUTHENTICATED":
      return tx("Zaloguj się, aby korzystać ze Studia.", "Sign in to use the Studio.");
    case "FORBIDDEN":
      return tx("Nie masz uprawnień do tej operacji.", "You do not have permission to do this.");
    case "NOT_FOUND":
    case "VIDEO_NOT_FOUND":
    case "CHANNEL_NOT_FOUND":
      return tx("Nie znaleziono tego elementu.", "That item was not found.");
    case "NO_CHANNEL":
      return tx("Najpierw załóż kanał.", "Create a channel first.");
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      return tx("Sprawdź wprowadzone dane i spróbuj ponownie.", "Check the data you entered and try again.");
    case "CONFLICT":
      return tx("Dane zmieniły się w międzyczasie. Odśwież stronę i spróbuj ponownie.", "The data changed in the meantime. Refresh the page and try again.");
    case "RATE_LIMITED":
      return tx("Za dużo prób. Spróbuj ponownie za chwilę.", "Too many attempts. Try again in a moment.");
    case "PLAYLIST_LIMIT":
      return tx("Kanał może mieć najwyżej {0} playlist.", "A channel can have at most {0} playlists.", PLAYLISTS_PER_CHANNEL_MAX);
    case "PLAYLIST_FULL":
      return tx("Playlista może mieć najwyżej {0} filmów.", "A playlist can hold at most {0} videos.", PLAYLIST_ITEMS_MAX);
    case "CHANNEL_CREATION_CLOSED":
      return tx("Zakładanie kanałów nie jest jeszcze otwarte.", "Creating channels is not open yet.");
    case "CHANNEL_INVITE_REQUIRED":
      return tx("Zakładanie kanałów jest na razie tylko na zaproszenie.", "Creating channels is invitation-only for now.");
    case "CHANNEL_LIMIT_REACHED":
      return tx("Masz już maksymalną liczbę kanałów.", "You already have the maximum number of channels.");
    case "CHANNEL_HANDLE_TAKEN":
      return tx("Ten uchwyt jest już zajęty.", "That handle is already taken.");
    case "CHANNEL_HANDLE_RATE_LIMITED":
      return tx("Uchwyt można zmienić najwyżej dwa razy na 14 dni.", "You can change the handle at most twice in 14 days.");
    case "CHANNEL_RENAME_RATE_LIMITED":
      return tx("Nazwę kanału można zmienić najwyżej dwa razy na 14 dni.", "You can rename the channel at most twice in 14 days.");
    case "CHANNEL_BANNER_INVALID":
      return tx("Baner musi być obrazem JPG, PNG lub WebP o rozmiarze do 300 KB po przycięciu.", "The banner must be a JPG, PNG or WebP image up to 300 KB after cropping.");
    case "CHANNEL_BIO_TOO_LONG":
      return tx("Opis kanału jest za długi.", "The channel description is too long.");
    case "UPLOAD_BAD_TYPE":
      return tx("To nie jest obsługiwany plik wideo.", "That is not a supported video file.");
    case "UPLOAD_BAD_SIZE":
      return tx("Plik jest pusty albo ma niepoprawny rozmiar.", "The file is empty or has an invalid size.");
    case "UPLOAD_TOO_LARGE":
      return tx("Plik jest za duży.", "The file is too large.");
    case "FILE_TOO_LARGE":
      return tx("Miniatura może mieć najwyżej 5 MB.", "The thumbnail can be at most 5 MB.");
    case "FILE_MISSING":
      return tx("Nie wybrano pliku.", "No file was chosen.");
    case "UPLOAD_STORAGE_LIMIT":
      return tx("Ten kanał nie ma już miejsca na kolejne filmy.", "This channel has no storage left for more videos.");
    case "ABORTED":
      return tx("Przesyłanie zostało przerwane.", "The upload was cancelled.");
    case "PART_FAILED":
    case "PART_ETAG_MISSING":
      return tx("Wysyłanie pliku nie powiodło się. Spróbuj ponownie.", "Sending the file failed. Please try again.");
    case "APPEAL_PENDING":
      return tx("Odwołanie od tej decyzji już czeka na rozpatrzenie.", "An appeal against this decision is already waiting for review.");
    case "APPEAL_RESOLVED":
    case "NOT_APPEALABLE":
      return tx("Od tej decyzji nie można się już odwołać.", "This decision can no longer be appealed.");
    default:
      return null;
  }
}

function byPrefix(code: string | undefined, tx: Tx): string | null {
  if (!code) return null;
  if (code.startsWith("CHANNEL_NAME_")) return tx("Sprawdź nazwę kanału.", "Check the channel name.");
  if (code.startsWith("CHANNEL_HANDLE_")) return tx("Ten uchwyt jest niedostępny. Wybierz inny.", "That handle is not available. Choose another.");
  if (code.startsWith("CHANNEL_ABOUT_")) return tx("Sprawdź dane w sekcji „O kanale”.", "Check the details in the About section.");
  return null;
}

function byStatus(status: number, tx: Tx): string | null {
  if (status === 401) return tx("Zaloguj się, aby korzystać ze Studia.", "Sign in to use the Studio.");
  if (status === 403) return tx("Nie masz uprawnień do tej operacji.", "You do not have permission to do this.");
  if (status === 404) return tx("Nie znaleziono tego elementu.", "That item was not found.");
  if (status === 429) return tx("Za dużo prób. Spróbuj ponownie za chwilę.", "Too many attempts. Try again in a moment.");
  if (status >= 500) return tx("Błąd serwera. Spróbuj ponownie.", "Server error. Please try again.");
  return null;
}
