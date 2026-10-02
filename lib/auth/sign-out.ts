import { authClient } from "./client";
import { clearReturnPath } from "./sso-return";

type GoogleIdentity = { accounts?: { id?: { disableAutoSelect?: () => void } } };

/**
 * The one way to sign out. Besides ending the session it tells Google Identity Services to stop
 * auto-selecting the previous account (`disableAutoSelect`), and drops the remembered return path, so on a
 * shared computer the next visitor is never continued as the previous user.
 */
export async function signOutCompletely(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    try {
      (window as unknown as { google?: GoogleIdentity }).google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      // Google's script is not loaded (One Tap never shown): nothing to disable
    }
    clearReturnPath();
  }
}
