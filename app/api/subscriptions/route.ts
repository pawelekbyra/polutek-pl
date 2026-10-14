import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from "@/lib/auth/server";
import { rateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getOrCreateCurrentUser } from "@/lib/modules/users";
import {
  GetSubscriptionStatusUseCase,
  SetSubscriptionNotifyUseCase,
  SubscribeUseCase,
  UnsubscribeUseCase,
  subscriptionNotifySchema,
  subscriptionTargetSchema,
} from "@/lib/modules/subscriptions";

function normalizeTrustedEmail(
  email: string | null | undefined,
): string | null {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export const dynamic = "force-dynamic";

function invalidRequest(message: string) {
  return NextResponse.json({ error: "INVALID_REQUEST", message }, { status: 400 });
}

/** JSON body of a write; an empty body is `{}` (the main channel, as before channels were addressable). */
async function readJsonBody(req: NextRequest): Promise<{ value: unknown } | { error: NextResponse }> {
  let text = "";
  try {
    text = await req.text();
  } catch {
    return { error: invalidRequest("Unreadable request body.") };
  }
  if (!text.trim()) return { value: {} };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: invalidRequest("Request body must be JSON.") };
  }
}

/** The channel a request addresses: `creatorId` in the body (or the query string), whitelisted by zod. */
async function parseTarget(req: NextRequest): Promise<{ creatorId?: string } | { error: NextResponse }> {
  const body = await readJsonBody(req);
  if ("error" in body) return body;
  const merged: Record<string, unknown> =
    body.value && typeof body.value === "object" && !Array.isArray(body.value) ? { ...(body.value as object) } : { __invalid: true };
  const fromQuery = req.nextUrl?.searchParams?.get("creatorId");
  if (merged.creatorId === undefined && fromQuery) merged.creatorId = fromQuery;
  const parsed = subscriptionTargetSchema.safeParse(merged);
  if (!parsed.success) return { error: invalidRequest("Invalid channel identifier.") };
  return { creatorId: parsed.data.creatorId };
}

async function enforceSubscriptionRateLimit(
  userId: string,
  action: "read" | "write",
) {
  const limit = action === "read" ? 120 : 20;
  const windowMs = action === "read" ? 60 * 1000 : 10 * 60 * 1000;
  const result = await rateLimit({
    key: `subscriptions:${action}:${userId}`,
    limit,
    windowMs,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Too many subscription requests. Please try again later.",
      },
      { status: 429 },
    );
  }

  return null;
}

async function requireAuthenticatedActor() {
  const actor = await getActorFromAuth();

  if (actor.type === "guest" || actor.type === "system") {
    return {
      error: NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Sign in to manage email notifications.",
        },
        { status: 401 },
      ),
    };
  }

  const ctx = createAppContext({
    actor,
    requestId: getCorrelationId() ?? undefined,
  });

  return { ctx, userId: actor.userId };
}

async function requireTrustedEmail(ctx: any) {
  // Only a verified address of the signed-in account is trusted for mailing consent.
  const { user } = await auth();
  const email = user?.emailVerified ? normalizeTrustedEmail(user.email) : null;

  if (!email) {
    return {
      error: NextResponse.json(
        {
          error: "TRUSTED_EMAIL_REQUIRED",
          message:
            "A verified account email is required to manage email notifications.",
        },
        { status: 400 },
      ),
    };
  }

  await getOrCreateCurrentUser(ctx, ctx.actor.userId);

  return { email };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const authResult = await requireAuthenticatedActor();
    if (authResult.error) return authResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(
      authResult.userId,
      "read",
    );
    if (rateLimited) return rateLimited;

    const rawCreatorId = req.nextUrl?.searchParams?.get("creatorId") ?? undefined;
    const parsed = subscriptionTargetSchema.safeParse({ creatorId: rawCreatorId });
    if (!parsed.success) return invalidRequest("Invalid channel identifier.");

    const result = await GetSubscriptionStatusUseCase.execute(authResult.ctx, { creatorId: parsed.data.creatorId });

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error("[SUBSCRIPTIONS_GET_ERROR]", error);
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const authResult = await requireAuthenticatedActor();
    if (authResult.error) return authResult.error;

    const target = await parseTarget(req);
    if ("error" in target) return target.error;

    const emailResult = await requireTrustedEmail(authResult.ctx);
    if (emailResult.error) return emailResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(
      authResult.userId,
      "write",
    );
    if (rateLimited) return rateLimited;

    const result = await SubscribeUseCase.execute(authResult.ctx, {
      trustedEmail: emailResult.email,
      creatorId: target.creatorId,
    });

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error("[SUBSCRIPTIONS_POST_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const authResult = await requireAuthenticatedActor();
    if (authResult.error) return authResult.error;

    const target = await parseTarget(req);
    if ("error" in target) return target.error;

    const emailResult = await requireTrustedEmail(authResult.ctx);
    if (emailResult.error) return emailResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(
      authResult.userId,
      "write",
    );
    if (rateLimited) return rateLimited;

    const result = await UnsubscribeUseCase.execute(authResult.ctx, {
      trustedEmail: emailResult.email,
      creatorId: target.creatorId,
    });

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error("[SUBSCRIPTIONS_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}

/** The bell of one subscription: `{ creatorId?, notify }`. Needs no e-mail work: consent is unchanged. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const authResult = await requireAuthenticatedActor();
    if (authResult.error) return authResult.error;

    const body = await readJsonBody(req);
    if ("error" in body) return body.error;
    const parsed = subscriptionNotifySchema.safeParse(body.value);
    if (!parsed.success) return invalidRequest("Expected { creatorId?: string, notify: boolean }.");

    const rateLimited = await enforceSubscriptionRateLimit(
      authResult.userId,
      "write",
    );
    if (rateLimited) return rateLimited;

    const result = await SetSubscriptionNotifyUseCase.execute(authResult.ctx, {
      creatorId: parsed.data.creatorId,
      notify: parsed.data.notify,
    });

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error("[SUBSCRIPTIONS_PATCH_ERROR]", error);
    return handleApiError(error);
  }
}
