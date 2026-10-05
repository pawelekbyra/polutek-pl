"use client";

import GoogleOneTapPrompt from "./GoogleOneTapPrompt";
import { SignUpLegalNotice } from "../legal/LegalDocLink";
import type { Locale } from "@/lib/i18n/routing";

/** Where Google draws the One Tap prompt when the browser has no FedCM (inside the dialog). */
export const ONE_TAP_CONTAINER_ID = "auth-modal-one-tap";

/**
 * Bottom of the sign-in and sign-up views: the Terms / Privacy Policy notice (every way to create an
 * account is in this window) and Google One Tap, which runs only while the window is open, i.e. after
 * the visitor asked to sign in. Stays mounted while switching between the two views.
 */
export default function SignUpFooter({ open, language, onSignedIn }: { open: boolean; language: Locale; onSignedIn: () => void }) {
  return (
    // A flex gap, not `space-y`: the One Tap slot is `display: none` while Google draws nothing into it,
    // and a hidden flex item gets no gap, so the window ends right under the notice (space-y would
    // still give the notice a bottom margin because the slot follows it).
    <div className="mt-4 flex flex-col gap-3">
      <SignUpLegalNotice language={language} />
      {open && (
        <>
          <div id={ONE_TAP_CONTAINER_ID} className="flex justify-center empty:hidden" />
          <GoogleOneTapPrompt containerId={ONE_TAP_CONTAINER_ID} onSignedIn={onSignedIn} />
        </>
      )}
    </div>
  );
}
