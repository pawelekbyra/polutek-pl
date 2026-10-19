import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { authorize } from "@/lib/modules/authz";
import { recordAuditEvent } from "@/lib/modules/audit";
import {
  PLAYLISTS_PER_CHANNEL_MAX,
  PLAYLIST_DESCRIPTION_MAX,
  PLAYLIST_ITEMS_MAX,
  PLAYLIST_TITLE_MAX,
  isPlaylistVisibility,
  pickUniqueSlug,
  slugifyPlaylistTitle,
  validateReorder,
  type PlaylistVisibilityValue,
} from "../domain/playlist-rules";
import type { StudioPlaylistSummaryDto } from "../domain/playlist.dto";
import { PlaylistRepository, type PlaylistRow } from "../infrastructure/playlist.repository";

/**
 * Creator-side playlist writes (docs/architecture/playlists.md). Every function authorizes first (CLAUDE.md 4.23),
 * scopes every lookup by channel (an id of another channel is simply "not found") and audits what it changed.
 * Writers of one playlist are serialized with a row lock inside one transaction.
 */

const notFound = () => new AppError("Nie znaleziono playlisty.", 404, "NOT_FOUND");
const invalid = (message: string) => new AppError(message, 400, "VALIDATION_ERROR");

export function toSummary(row: PlaylistRow, itemCount: number): StudioPlaylistSummaryDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    visibility: row.visibility as PlaylistVisibilityValue,
    itemCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function cleanTitle(value: string | undefined): string | AppError {
  const title = (value ?? "").trim();
  if (title.length < 1) return invalid("Podaj tytuł playlisty.");
  if (title.length > PLAYLIST_TITLE_MAX) return invalid(`Tytuł może mieć najwyżej ${PLAYLIST_TITLE_MAX} znaków.`);
  return title;
}

function cleanDescription(value: string | null | undefined): string | null | AppError {
  if (value === null || value === undefined) return null;
  const description = value.trim();
  if (description.length > PLAYLIST_DESCRIPTION_MAX) return invalid(`Opis może mieć najwyżej ${PLAYLIST_DESCRIPTION_MAX} znaków.`);
  return description || null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createPlaylist(
  ctx: AppContext,
  input: { channelId: string; title: string; description?: string | null; visibility?: string },
): Promise<UseCaseResult<StudioPlaylistSummaryDto>> {
  const denied = await authorize(ctx, "playlist.create", { channelId: input.channelId });
  if (denied) return fail(denied);

  const title = cleanTitle(input.title);
  if (title instanceof AppError) return fail(title);
  const description = cleanDescription(input.description);
  if (description instanceof AppError) return fail(description);
  const visibility = input.visibility ?? "PUBLIC";
  if (!isPlaylistVisibility(visibility)) return fail(invalid("Nieprawidłowa widoczność playlisty."));

  const base = slugifyPlaylistTitle(title);
  // The slug is unique per channel (database constraint). Two creators racing for the same title is rare; a lost race
  // surfaces as a unique violation and the next attempt sees the winner's slug.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await ctx.db.writeTransaction(async (tx): Promise<UseCaseResult<StudioPlaylistSummaryDto>> => {
        const repo = new PlaylistRepository(tx);
        if ((await repo.countActive(input.channelId)) >= PLAYLISTS_PER_CHANNEL_MAX) {
          return fail(new AppError(`Kanał może mieć najwyżej ${PLAYLISTS_PER_CHANNEL_MAX} playlist.`, 409, "PLAYLIST_LIMIT"));
        }
        const slug = pickUniqueSlug(base, await repo.takenSlugs(input.channelId, base));
        const row = await repo.create({ channelId: input.channelId, title, description, visibility, slug });
        await recordAuditEvent(
          ctx,
          { action: "PLAYLIST_CREATED", targetType: "Playlist", targetId: row.id, channelId: input.channelId, metadata: { visibility } },
          tx,
        );
        return ok(toSummary(row, 0));
      });
      return result;
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) continue;
      throw error;
    }
  }
  return fail(new AppError("Nie udało się utworzyć playlisty. Spróbuj ponownie.", 409, "CONFLICT"));
}

export async function updatePlaylist(
  ctx: AppContext,
  input: { channelId: string; playlistId: string; title?: string; description?: string | null; visibility?: string },
): Promise<UseCaseResult<StudioPlaylistSummaryDto>> {
  const denied = await authorize(ctx, "playlist.update", { channelId: input.channelId });
  if (denied) return fail(denied);

  const patch: { title?: string; description?: string | null; visibility?: PlaylistVisibilityValue } = {};
  if (input.title !== undefined) {
    const title = cleanTitle(input.title);
    if (title instanceof AppError) return fail(title);
    patch.title = title;
  }
  if (input.description !== undefined) {
    const description = cleanDescription(input.description);
    if (description instanceof AppError) return fail(description);
    patch.description = description;
  }
  if (input.visibility !== undefined) {
    if (!isPlaylistVisibility(input.visibility)) return fail(invalid("Nieprawidłowa widoczność playlisty."));
    patch.visibility = input.visibility;
  }
  if (Object.keys(patch).length === 0) return fail(invalid("Brak zmian do zapisania."));

  return ctx.db.writeTransaction(async (tx) => {
    const repo = new PlaylistRepository(tx);
    const existing = await repo.findInChannel(input.playlistId, input.channelId);
    if (!existing) return fail(notFound());
    const row = await repo.update(existing.id, patch);
    await recordAuditEvent(
      ctx,
      { action: "PLAYLIST_UPDATED", targetType: "Playlist", targetId: row.id, channelId: input.channelId, metadata: { fields: Object.keys(patch), visibility: row.visibility } },
      tx,
    );
    return ok(toSummary(row, await repo.countItems(row.id)));
  });
}

/** Soft delete: the playlist disappears everywhere at once, its slug stays reserved. */
export async function deletePlaylist(ctx: AppContext, input: { channelId: string; playlistId: string }): Promise<UseCaseResult<{ id: string }>> {
  const denied = await authorize(ctx, "playlist.delete", { channelId: input.channelId });
  if (denied) return fail(denied);

  return ctx.db.writeTransaction(async (tx) => {
    const repo = new PlaylistRepository(tx);
    const existing = await repo.findInChannel(input.playlistId, input.channelId);
    if (!existing) return fail(notFound());
    await repo.softDelete(existing.id, ctx.now());
    await recordAuditEvent(ctx, { action: "PLAYLIST_DELETED", targetType: "Playlist", targetId: existing.id, channelId: input.channelId }, tx);
    return ok({ id: existing.id });
  });
}

/** Adds one video of the SAME channel to the end of the playlist. A video appears once; a playlist holds at most 200. */
export async function addPlaylistVideo(
  ctx: AppContext,
  input: { channelId: string; playlistId: string; videoId: string },
): Promise<UseCaseResult<{ videoId: string; position: number }>> {
  const denied = await authorize(ctx, "playlist.manage_items", { channelId: input.channelId });
  if (denied) return fail(denied);

  return ctx.db.writeTransaction(async (tx) => {
    const repo = new PlaylistRepository(tx);
    await repo.lock(input.playlistId);
    const existing = await repo.findInChannel(input.playlistId, input.channelId);
    if (!existing) return fail(notFound());
    // A playlist only holds videos of its own channel: a foreign id looks exactly like a missing video.
    if (!(await repo.findChannelVideo(input.videoId, input.channelId))) return fail(new AppError("Nie znaleziono filmu.", 404, "NOT_FOUND"));
    if (await repo.hasItem(existing.id, input.videoId)) return fail(new AppError("Ten film jest już na playliście.", 409, "CONFLICT"));
    if ((await repo.countItems(existing.id)) >= PLAYLIST_ITEMS_MAX) {
      return fail(new AppError(`Playlista może mieć najwyżej ${PLAYLIST_ITEMS_MAX} filmów.`, 409, "PLAYLIST_FULL"));
    }
    const position = await repo.nextPosition(existing.id);
    await repo.addItem(existing.id, input.videoId, position);
    await repo.touch(existing.id);
    await recordAuditEvent(
      ctx,
      { action: "PLAYLIST_VIDEO_ADDED", targetType: "Playlist", targetId: existing.id, channelId: input.channelId, metadata: { videoId: input.videoId, position } },
      tx,
    );
    return ok({ videoId: input.videoId, position });
  });
}

/** Removes a video from the playlist (positions keep their order; gaps are fine). */
export async function removePlaylistVideo(
  ctx: AppContext,
  input: { channelId: string; playlistId: string; videoId: string },
): Promise<UseCaseResult<{ videoId: string }>> {
  const denied = await authorize(ctx, "playlist.manage_items", { channelId: input.channelId });
  if (denied) return fail(denied);

  return ctx.db.writeTransaction(async (tx) => {
    const repo = new PlaylistRepository(tx);
    await repo.lock(input.playlistId);
    const existing = await repo.findInChannel(input.playlistId, input.channelId);
    if (!existing) return fail(notFound());
    if ((await repo.removeItem(existing.id, input.videoId)) === 0) return fail(new AppError("Tego filmu nie ma na playliście.", 404, "NOT_FOUND"));
    await repo.touch(existing.id);
    await recordAuditEvent(
      ctx,
      { action: "PLAYLIST_VIDEO_REMOVED", targetType: "Playlist", targetId: existing.id, channelId: input.channelId, metadata: { videoId: input.videoId } },
      tx,
    );
    return ok({ videoId: input.videoId });
  });
}

/**
 * Applies a whole new order in ONE transaction. The request must name exactly the videos the playlist holds now
 * (see `validateReorder`); a stale or malformed order is refused before anything is written, and a failure halfway
 * rolls every position back.
 */
export async function reorderPlaylist(
  ctx: AppContext,
  input: { channelId: string; playlistId: string; videoIds: string[] },
): Promise<UseCaseResult<{ videoIds: string[] }>> {
  const denied = await authorize(ctx, "playlist.manage_items", { channelId: input.channelId });
  if (denied) return fail(denied);

  return ctx.db.writeTransaction(async (tx) => {
    const repo = new PlaylistRepository(tx);
    await repo.lock(input.playlistId);
    const existing = await repo.findInChannel(input.playlistId, input.channelId);
    if (!existing) return fail(notFound());

    const check = validateReorder(await repo.orderedVideoIds(existing.id), input.videoIds);
    if (!check.ok) {
      return fail(
        check.reason === "MISMATCH"
          ? new AppError("Lista filmów zmieniła się w międzyczasie. Odśwież stronę i spróbuj ponownie.", 409, "CONFLICT")
          : invalid(check.reason === "TOO_MANY" ? "Za dużo filmów." : "Film występuje na liście więcej niż raz."),
      );
    }
    for (const { videoId, position } of check.assignments) await repo.setPosition(existing.id, videoId, position);
    await repo.touch(existing.id);
    await recordAuditEvent(
      ctx,
      { action: "PLAYLIST_REORDERED", targetType: "Playlist", targetId: existing.id, channelId: input.channelId, metadata: { count: check.assignments.length } },
      tx,
    );
    return ok({ videoIds: [...input.videoIds] });
  });
}
