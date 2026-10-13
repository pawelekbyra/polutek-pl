import { COVER_MAX_BYTES, uploadVideoCover } from "@/lib/modules/admin-content";
import { studioError, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** `multipart/form-data` with one `file` (JPG, PNG or WebP, up to 5 MB); bytes are checked by magic number. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > COVER_MAX_BYTES + 64 * 1024) return studioError(413, "Miniatura może mieć najwyżej 5 MB.", "FILE_TOO_LARGE");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return studioError(400, "Nie wybrano pliku.", "FILE_MISSING");
    if (file.size > COVER_MAX_BYTES) return studioError(413, "Miniatura może mieć najwyżej 5 MB.", "FILE_TOO_LARGE");
    const bytes = new Uint8Array(await file.arrayBuffer());
    return studioResult(await uploadVideoCover({ videoId: id, bytes }, ctx));
  });
}
