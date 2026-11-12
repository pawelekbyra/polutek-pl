import { COVER_MAX_BYTES, uploadVideoCover } from "@/lib/modules/admin-content";
import { studioError, studioResult, withStudio } from "@/lib/api/studio-route";
import { MalformedFormDataBodyError, readRequestFormDataWithLimit, RequestBodyTooLargeError, TooManyFormEntriesError } from "@/lib/utils/request-body";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** `multipart/form-data` with one `file` (JPG, PNG or WebP, up to 5 MB); bytes are checked by magic number. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    let form: FormData;
    try {
      form = await readRequestFormDataWithLimit(request, COVER_MAX_BYTES + 64 * 1024, 8);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return studioError(413, "Miniatura lub formularz przekracza dozwolony rozmiar.", "FILE_TOO_LARGE");
      if (error instanceof TooManyFormEntriesError) return studioError(413, "Formularz zawiera za dużo części.", "TOO_MANY_PARTS");
      if (error instanceof MalformedFormDataBodyError) return studioError(400, "Niepoprawny formularz.", "BAD_REQUEST");
      return studioError(400, "Niepoprawny formularz.", "BAD_REQUEST");
    }
    const file = form?.get("file");
    if (form.getAll("file").length !== 1) return studioError(400, "Formularz musi zawierać dokładnie jeden plik.", "BAD_REQUEST");
    if (!file || typeof file === "string") return studioError(400, "Nie wybrano pliku.", "FILE_MISSING");
    if (file.size > COVER_MAX_BYTES) return studioError(413, "Miniatura może mieć najwyżej 5 MB.", "FILE_TOO_LARGE");
    const bytes = new Uint8Array(await file.arrayBuffer());
    return studioResult(await uploadVideoCover({ videoId: id, bytes }, ctx));
  });
}
