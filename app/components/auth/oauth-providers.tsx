import React from "react";
import type { OAuthStrategy } from "@clerk/shared/types";

// Single source of truth for the social sign-in providers the site offers. This must match the
// providers enabled in the Clerk dashboard — rendering a button for a provider Clerk doesn't have
// enabled would error on click. To add a provider (e.g. Microsoft) later, enable it in Clerk and
// add one entry here; both the auth modal and the account "connected accounts" panel pick it up.
export type OAuthProviderConfig = {
  strategy: OAuthStrategy;
  /** Matches ExternalAccountResource.provider (strategy without the "oauth_" prefix). */
  provider: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
};

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
  </svg>
);

const AppleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M16.36 12.9c-.02-2.02 1.65-2.99 1.72-3.04-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.43.73-3.06.73-.63 0-1.6-.71-2.64-.69-1.36.02-2.61.79-3.31 2-1.41 2.45-.36 6.07 1.01 8.06.67.97 1.47 2.06 2.51 2.02 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.09-.02 1.78-.99 2.44-1.97.77-1.13 1.09-2.22 1.11-2.28-.02-.01-2.13-.82-2.15-3.26ZM14.38 6.88c.55-.67.93-1.6.82-2.53-.8.03-1.77.53-2.35 1.2-.51.59-.96 1.53-.84 2.44.9.07 1.81-.45 2.37-1.11Z" />
  </svg>
);

const MicrosoftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
    <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
    <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
    <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
  </svg>
);

// Providers enabled in Clerk for this instance. Google + Apple are live today; Microsoft is ready
// to enable — uncomment its entry once it's turned on in the Clerk dashboard.
export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  { strategy: "oauth_google", provider: "google", label: "Google", Icon: GoogleIcon },
  { strategy: "oauth_apple", provider: "apple", label: "Apple", Icon: AppleIcon },
  // { strategy: "oauth_microsoft", provider: "microsoft", label: "Microsoft", Icon: MicrosoftIcon },
];

// Exported so a provider added to OAUTH_PROVIDERS later can reuse the icon without redefining it.
export const PROVIDER_ICONS = { GoogleIcon, AppleIcon, MicrosoftIcon };
