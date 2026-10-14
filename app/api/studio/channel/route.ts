import { createChannel, requestChannelDeletion, updateChannelProfile } from "@/lib/modules/channel";
import { createChannelSchema, updateChannelProfileSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Creates the user's channel (behind the `channelCreation` gate, one channel per user by default). */
export async function POST(request: Request) {
  return withStudio(request, { channel: false }, async ({ ctx }) => {
    const body = await readStudioJson(request, createChannelSchema);
    if (!body.ok) return body.response;
    return studioResult(await createChannel(ctx, body.data), 201);
  });
}

/** Name, bio, language and country of the channel (the name is rate limited). */
export async function PATCH(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const body = await readStudioJson(request, updateChannelProfileSchema);
    if (!body.ok) return body.response;
    return studioResult(await updateChannelProfile(ctx, body.data));
  });
}

/** Soft delete: hidden at once, restorable for 30 days. */
export async function DELETE(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => studioResult(await requestChannelDeletion(ctx)));
}
