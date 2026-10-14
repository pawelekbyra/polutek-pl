import { CommentStatus, VideoCommentsMode } from "@prisma/client";
import { Actor } from "@/lib/modules/shared/actor";
import { AccessDecisionDto } from "@/lib/modules/access";

export type ModerationAction = "hide" | "hold" | "approve" | "restore" | "delete";

/**
 * The moderation state machine, in one place: the statuses each action may start from.
 * DELETED is final. "restore" brings back only what moderation hid or held; a comment its
 * author deleted (or a moderator deleted) never comes back.
 */
const MODERATION_TRANSITIONS: Record<ModerationAction, readonly CommentStatus[]> = {
  hide: [CommentStatus.VISIBLE, CommentStatus.HELD_FOR_REVIEW],
  hold: [CommentStatus.VISIBLE],
  approve: [CommentStatus.HELD_FOR_REVIEW],
  restore: [CommentStatus.HIDDEN, CommentStatus.HELD_FOR_REVIEW],
  delete: [CommentStatus.VISIBLE, CommentStatus.HELD_FOR_REVIEW, CommentStatus.HIDDEN],
};

export class CommentPolicy {
  /**
   * Status a NEW comment (or viewer reply) gets under the video's `commentsMode`, or `null` when new comments are
   * switched off. ON: visible at once; HELD: waits in the existing review queue (`HELD_FOR_REVIEW`, approved through
   * the moderation use cases); OFF: rejected. People who moderate the video (its channel owner, platform staff)
   * are never limited by the mode. Existing comments are not touched by a mode change.
   */
  static statusForNewComment(mode: VideoCommentsMode | null | undefined, canModerate: boolean): CommentStatus | null {
    if (canModerate) return CommentStatus.VISIBLE;
    if (mode === VideoCommentsMode.OFF) return null;
    if (mode === VideoCommentsMode.HELD) return CommentStatus.HELD_FOR_REVIEW;
    return CommentStatus.VISIBLE;
  }

  /**
   * General rule: To perform any write interaction under a video,
   * the actor must have access to that video.
   */
  static canInteractWithVideo(actor: Actor, videoAccess: AccessDecisionDto): boolean {
    if (actor.type === 'system') return true;
    if (actor.type === 'guest') return false;
    // No comments or reactions under a placeholder name (audit AUTH-11): finish onboarding first.
    if (CommentPolicy.isOnboardingPending(actor)) return false;
    return videoAccess.hasAccess;
  }

  static canCreateComment(actor: Actor, videoAccess: AccessDecisionDto): boolean {
    return this.canInteractWithVideo(actor, videoAccess);
  }

  static canReactToVideo(actor: Actor, videoAccess: AccessDecisionDto): boolean {
    return this.canInteractWithVideo(actor, videoAccess);
  }

  static canReactToComment(actor: Actor, videoAccess: AccessDecisionDto): boolean {
    return this.canInteractWithVideo(actor, videoAccess);
  }

  static canReportComment(actor: Actor, videoAccess: AccessDecisionDto): boolean {
    if (actor.type === 'guest') return false;
    // To report, you must be able to see the comments (inherit video access)
    return videoAccess.hasAccess;
  }

  static isOnboardingPending(actor: Actor): boolean {
    return actor.type === 'user' && actor.onboardingPending === true;
  }

  /** Only the author edits a comment. Moderators hide or delete; they never rewrite someone's words. */
  static canUpdateComment(actor: Actor, commentAuthorId: string): boolean {
    if (CommentPolicy.isOnboardingPending(actor)) return false;
    if (actor.type === 'user' || actor.type === 'admin') {
      return actor.userId === commentAuthorId;
    }
    return false;
  }

  static canDeleteComment(actor: Actor, commentAuthorId: string, isModeratorOfVideo: boolean): boolean {
    if (actor.type === 'admin') return true;
    if (isModeratorOfVideo) return true;
    if (actor.type === 'user') {
        return actor.userId === commentAuthorId;
    }
    return false;
  }

  static canModerateComment(actor: Actor, isModeratorOfVideo: boolean): boolean {
    if (actor.type === 'admin') return true;
    return isModeratorOfVideo;
  }

  /** Statuses a moderation action may start from. */
  static moderationSources(action: ModerationAction): readonly CommentStatus[] {
    return MODERATION_TRANSITIONS[action];
  }

  static canTransition(action: ModerationAction, from: CommentStatus): boolean {
    return MODERATION_TRANSITIONS[action].includes(from);
  }
}
