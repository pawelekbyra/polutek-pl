import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { GetOrCreateUserUseCase } from "@/lib/modules/users";
import {
  GetSubscriptionStatusUseCase,
  SubscribeUseCase,
  UnsubscribeUseCase,
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
  const { sessionClaims } = await auth();
  const claims = sessionClaims as any;
  const email = normalizeTrustedEmail(
    claims?.email ||
      claims?.primary_email_address ||
      claims?.email_address ||
      claims?.primaryEmailAddress,
  );

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

  // Sync user profile on write operations
  await GetOrCreateUserUseCase.execute(ctx, {
    id: ctx.actor.userId,
    email,
    name: (sessionClaims as any)?.name,
    username: (sessionClaims as any)?.username,
    imageUrl:
      (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture,
  });

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

    const result = await GetSubscriptionStatusUseCase.execute(authResult.ctx);

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

    const emailResult = await requireTrustedEmail(authResult.ctx);
    if (emailResult.error) return emailResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(
      authResult.userId,
      "write",
    );
    if (rateLimited) return rateLimited;

    const result = await SubscribeUseCase.execute(authResult.ctx, {
      trustedEmail: emailResult.email,
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

    const emailResult = await requireTrustedEmail(authResult.ctx);
    if (emailResult.error) return emailResult.error;

    const rateLimited = await enforceSubscriptionRateLimit(
      authResult.userId,
      "write",
    );
    if (rateLimited) return rateLimited;

    const result = await UnsubscribeUseCase.execute(authResult.ctx, {
      trustedEmail: emailResult.email,
    });

    return NextResponse.json(result);
  } catch (error) {
    scopedLogger.error("[SUBSCRIPTIONS_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}
