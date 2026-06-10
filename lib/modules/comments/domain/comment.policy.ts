import { Actor } from "@/lib/modules/shared/actor";
import { AccessDecisionDto } from "@/lib/modules/access";

export class CommentPolicy {
  /**
   * General rule: To perform any write interaction under a video,
   * the actor must have access to that video.
   */
  static canInteractWithVideo(actor: Actor, videoAccess: AccessDecisionDto): boolean {
    if (actor.type === 'system') return true;
    if (actor.type === 'guest') return false;

    // Admin bypass is usually handled within checkVideoAccess (returning hasAccess: true)
    // but we can be explicit here if needed.
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

  static canUpdateComment(actor: Actor, commentAuthorId: string): boolean {
    if (actor.type === 'admin') return true;
    if (actor.type === 'user') {
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
}
