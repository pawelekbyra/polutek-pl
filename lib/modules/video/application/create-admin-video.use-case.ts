import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { logger } from "@/lib/logger";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, CreateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoSlugConflictError } from "../domain/video.errors";
import { Prisma } from "@prisma/client";

const DEFAULT_DRAFT_THUMBNAIL_URL = "/logo.png";

function normalizeCreateVideoInput(input: CreateVideoInput): CreateVideoInput | AppError {
  const title = input.title?.trim();
  if (!title) {
    return new AppError("Podaj tytuł filmu przed utworzeniem szkicu.", 400, "VIDEO_TITLE_REQUIRED");
  }

  const slug = input.slug?.trim();
  if (!slug) {
    return new AppError("Podaj lub wygeneruj slug filmu przed utworzeniem szkicu.", 400, "VIDEO_SLUG_REQUIRED");
  }

  return {
    title,
    slug,
    thumbnailUrl: input.thumbnailUrl?.trim() || DEFAULT_DRAFT_THUMBNAIL_URL,
    duration: input.duration?.trim() || null,
    tier: input.tier,
    description: input.description?.trim() || null,
    titleEn: input.titleEn?.trim() || null,
    descriptionEn: input.descriptionEn?.trim() || null,
  };
}

function prismaMetaValue(
  error: Prisma.PrismaClientKnownRequestError,
  key: string,
): string | null {
  const value = error.meta?.[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return null;
}

function mapCreateVideoPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  slug: string,
): AppError {
  if (error.code === "P2002") {
    return new VideoSlugConflictError(slug);
  }

  if (error.code === "P2003") {
    const field = prismaMetaValue(error, "field_name");
    return new AppError(
      `Nie można utworzyć szkicu filmu: baza odrzuciła powiązanie${field ? ` (${field})` : ""}. Sprawdź, czy główny kanał/creator i użytkownik admina istnieją w produkcyjnej bazie.`,
      409,
      "VIDEO_CREATE_DB_RELATION_ERROR",
    );
  }

  if (error.code === "P2021") {
    const table = prismaMetaValue(error, "table");
    return new AppError(
      `Nie można utworzyć szkicu filmu: w produkcyjnej bazie brakuje wymaganej tabeli${table ? ` (${table})` : ""}. Uruchom migracje Prisma dla tej bazy.`,
      500,
      "VIDEO_CREATE_DB_TABLE_MISSING",
    );
  }

  if (error.code === "P2022") {
    const column = prismaMetaValue(error, "column");
    return new AppError(
      `Nie można utworzyć szkicu filmu: produkcyjna baza ma nieaktualny schemat${column ? `, brakuje kolumny ${column}` : ""}. Uruchom migracje Prisma dla tej bazy.`,
      500,
      "VIDEO_CREATE_DB_COLUMN_MISSING",
    );
  }

  if (error.code === "P2025") {
    return new AppError(
      "Nie można utworzyć szkicu filmu: nie znaleziono wymaganego rekordu w produkcyjnej bazie.",
      404,
      "VIDEO_CREATE_REQUIRED_RECORD_NOT_FOUND",
    );
  }

  return new AppError(
    `Nie można utworzyć szkicu filmu: błąd bazy danych Prisma ${error.code}.`,
    500,
    `VIDEO_CREATE_DB_${error.code}`,
  );
}

export async function createAdminVideo(
  input: CreateVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, AppError>> {
  const normalizedInput = normalizeCreateVideoInput(input);
  if (normalizedInput instanceof AppError) return fail(normalizedInput);

  const mainChannel = await MainChannelService.getRequired(ctx);

  const repository = new VideoRepository(ctx.prisma);

  try {
    const video = await ctx.db.writeTransaction(async (tx) => {
      return repository.createForMainChannel(normalizedInput, mainChannel.id, tx);
    });

    try {
      await recordAuditEvent(ctx, {
        action: 'VIDEO_CREATED',
        targetType: 'Video',
        targetId: video.id,
        metadata: { title: video.title }
      });
    } catch (auditError) {
      logger.error("[ADMIN_VIDEO_CREATE_AUDIT_ERROR] Draft was created but audit log failed", auditError);
    }

    return ok(toAdminVideoDto(video));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return fail(mapCreateVideoPrismaError(error, normalizedInput.slug));
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      return fail(new AppError(
        "Nie można utworzyć szkicu filmu: payload nie pasuje do schematu Prisma. Sprawdź pola formularza i aktualność wygenerowanego Prisma Client.",
        500,
        "VIDEO_CREATE_PRISMA_VALIDATION_ERROR",
      ));
    }
    throw error;
  }
}
