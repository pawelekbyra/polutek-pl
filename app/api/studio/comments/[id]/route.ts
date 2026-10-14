import {
  approveHeldComment,
  deleteAdminComment,
  hideAdminComment,
  holdCommentForReview,
  restoreAdminComment,
  setAdminCommentHeart,
  createCreatorReply,
  pinComment,
  unpinComment,
} from "@/lib/modules/comments";
import { commentActionSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioError, studioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * One moderation action on a comment of the channel: hide, approve, restore, hold, delete, heart, unheart, pin, unpin or reply as
 * the creator. Each use case authorizes against the comment's own channel, so another channel's comment id is refused.
 */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, commentActionSchema);
    if (!body.ok) return body.response;
    const { action, text, heart } = body.data;
    switch (action) {
      case "hide":
        return studioResult(await hideAdminComment(id, ctx));
      case "approve":
        return studioResult(await approveHeldComment(id, ctx));
      case "restore":
        return studioResult(await restoreAdminComment(id, ctx));
      case "hold":
        return studioResult(await holdCommentForReview(id, ctx));
      case "delete":
        return studioResult(await deleteAdminComment({ commentId: id }, ctx));
      case "heart":
        return studioResult(await setAdminCommentHeart(ctx, { commentId: id, hearted: true }));
      case "unheart":
        return studioResult(await setAdminCommentHeart(ctx, { commentId: id, hearted: false }));
      case "pin":
        return studioResult(await pinComment({ commentId: id }, ctx));
      case "unpin":
        return studioResult(await unpinComment({ commentId: id }, ctx));
      case "reply":
        if (!text?.trim()) return studioError(400, "Wpisz treść odpowiedzi.", "VALIDATION_ERROR");
        return studioResult(await createCreatorReply(ctx, { commentId: id, text, heart }));
      default:
        return studioJson({ ok: false });
    }
  });
}
