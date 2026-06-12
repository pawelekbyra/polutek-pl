import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('subscriptions route consent boundary', () => {
  it('does not read arbitrary email from request body for subscribe/unsubscribe', () => {
    const source = fs.readFileSync('app/api/subscriptions/route.ts', 'utf8');

    expect(source).toContain('normalizeTrustedEmail');
    // POST and DELETE might read body for other things (though currently they don't seem to)
    // but they MUST NOT read email from it.
    expect(source).not.toMatch(/trustedEmail:\s*.*body/i);
  });

  it('GET /api/subscriptions rejects guest with 401', () => {
    const code = fs.readFileSync('app/api/subscriptions/route.ts', 'utf8');
    expect(code).toContain("const actor = await getActorFromAuth()");
    expect(code).toContain("if (actor.type === 'guest' || actor.type === 'system')");
    expect(code).toContain("status: 401");
  });

  it('GET /api/subscriptions does NOT require trusted email or call GetOrCreateUser', () => {
    const code = fs.readFileSync('app/api/subscriptions/route.ts', 'utf8');

    // Check GET implementation
    const getMatch = code.match(/export async function GET\([^)]+\): Promise<NextResponse> \{([\s\S]+?)\n\}/);
    const getCode = getMatch ? getMatch[1] : '';

    expect(getCode).toContain("const authResult = await requireAuthenticatedActor()");
    expect(getCode).not.toContain("requireTrustedEmail");

    // Verify requireAuthenticatedActor doesn't do user sync or auth() email extraction
    expect(code).toContain("async function requireAuthenticatedActor()");
    const authHelperMatch = code.match(/async function requireAuthenticatedActor\(\) \{([\s\S]+?)\n\}/);
    const authHelperCode = authHelperMatch ? authHelperMatch[1] : '';
    expect(authHelperCode).not.toContain("GetOrCreateUserUseCase");
    expect(authHelperCode).not.toContain("auth()");
  });

  it('POST/DELETE /api/subscriptions require trusted email and perform user sync', () => {
    const code = fs.readFileSync('app/api/subscriptions/route.ts', 'utf8');

    expect(code).toContain("async function requireTrustedEmail");
    const emailHelperMatch = code.match(/async function requireTrustedEmail\([^)]+\) \{([\s\S]+?)\n\}/);
    const emailHelperCode = emailHelperMatch ? emailHelperMatch[1] : '';

    expect(emailHelperCode).toContain("const { sessionClaims } = await auth()");
    expect(emailHelperCode).toContain("normalizeTrustedEmail");
    expect(emailHelperCode).toContain("GetOrCreateUserUseCase.execute");

    expect(code).toContain("export async function POST");
    expect(code).toContain("export async function DELETE");
  });
});
