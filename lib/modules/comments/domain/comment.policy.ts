import { Actor } from "@/lib/modules/shared/actor";
import { AccessTier } from "@prisma/client";

export class CommentPolicy {
  /**
   * canView determines if an actor can see comments on a specific video.
   * Based on current product rules, if you can see the video (even if it's a paywall teaser),
   * you can usually see the comments.
   */
  static canView(actor: Actor, videoAccess: { hasAccess: boolean; reason?: string }): boolean {
    // If video is not found or deleted, we hide everything.
    if (videoAccess.reason === 'NOT_FOUND' || videoAccess.reason === 'DELETED') {
      return false;
    }

    // Otherwise, viewing comments is generally allowed if the video exists.
    return true;
  }

  /**
   * canCreate determines if an actor can post a comment.
   * Rule: Must be logged in AND have full access to the video content.
   */
  static canCreate(actor: Actor, videoAccess: { hasAccess: boolean }): boolean {
    if (actor.type === 'guest') return false;

    // Admin bypass
    if (actor.type === 'admin') return true;

    // Non-patron cannot comment on patron-only video
    return videoAccess.hasAccess;
  }

  /**
   * canUpdate determines if an actor can edit a comment.
   * Rule: Only the author can edit their own comment.
   */
  static canUpdate(actor: Actor, commentAuthorId: string): boolean {
    if (actor.type !== 'user' && actor.type !== 'admin') return false;

    // Authors can edit their own comments.
    // In our system, admins can MODERATE (hide/delete) but usually don't EDIT the text of others.
    if (actor.type === 'user' || actor.type === 'admin') {
      return (actor as any).userId === commentAuthorId;
    }

    return false;
  }

  /**
   * canDelete determines if an actor can delete a comment.
   * Rule: Author can delete their own, Admin can delete any.
   */
  static canDelete(actor: Actor, commentAuthorId: string): boolean {
    if (actor.type === 'guest') return false;
    if (actor.type === 'admin') return true;

    if (actor.type === 'user') {
      return actor.userId === commentAuthorId;
    }

    return false;
  }

  /**
   * canReact determines if an actor can like a comment.
   * Rule: Must be logged in AND have full access to the video content.
   */
  static canReact(actor: Actor, videoAccess: { hasAccess: boolean }): boolean {
    if (actor.type === 'guest') return false;

    // Admin bypass
    if (actor.type === 'admin') return true;

    // Non-patron cannot react on patron-only video
    return videoAccess.hasAccess;
  }

  /**
   * canModerate determines if an actor can pin, heart, or hide a comment.
   * In single-channel mode, this is restricted to Admin.
   */
  static canModerate(actor: Actor): boolean {
    return actor.type === 'admin';
  }
}
