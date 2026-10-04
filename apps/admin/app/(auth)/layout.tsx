import type { ReactNode } from "react";

/** Sign-in and enrollment screens: no shell, no data, one centred card. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="auth-page">
      {children}
    </main>
  );
}
