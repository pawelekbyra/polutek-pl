import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard for CLERK-CUSTOM-AUTH-UI-001: we replaced all default Clerk UI with our own
 * design-system components and keep Clerk as the backend (headless hooks only). This test fails
 * if any default Clerk UI component or the "Secured by Clerk" branding is reintroduced under app/.
 * Headless hooks (useUser/useAuth/useSignIn/useSignUp/useClerk) are allowed.
 */
const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /<SignInButton\b/, label: "<SignInButton>" },
  { pattern: /<SignUpButton\b/, label: "<SignUpButton>" },
  { pattern: /<UserButton\b/, label: "<UserButton>" },
  { pattern: /UserButton\.(MenuItems|Link|Action)/, label: "UserButton.*" },
  { pattern: /<UserProfile\b/, label: "<UserProfile>" },
  { pattern: /<SignedIn\b/, label: "<SignedIn>" },
  { pattern: /<SignedOut\b/, label: "<SignedOut>" },
  { pattern: /<SignIn\b/, label: "<SignIn>" },
  { pattern: /<SignUp\b/, label: "<SignUp>" },
  { pattern: /\bopenSignIn\s*\(/, label: "openSignIn()" },
  { pattern: /\bopenSignUp\s*\(/, label: "openSignUp()" },
  { pattern: /Secured by Clerk/i, label: '"Secured by Clerk"' },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("Clerk custom-UI guard", () => {
  it("does not reintroduce default Clerk UI components anywhere under app/", () => {
    const files = walk(join(process.cwd(), "app"));
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(source)) {
          violations.push(`${file.replace(process.cwd() + "/", "")}: ${label}`);
        }
      }
    }

    expect(violations, `Default Clerk UI must be replaced with our own components:\n${violations.join("\n")}`).toEqual([]);
  });
});
