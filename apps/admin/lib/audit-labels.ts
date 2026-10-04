/** Polish names of audit actions shown in a film's history. Unknown actions show their code. */
export const AUDIT_LABEL: Record<string, string> = {
  VIDEO_CREATED: "Film utworzony",
  VIDEO_UPDATED: "Zmiany w filmie",
  VIDEO_PUBLISHED: "Opublikowano",
  VIDEO_ARCHIVED: "Zarchiwizowano",
  VIDEO_DELETED: "Usunięto",
  VIDEO_REORDERED: "Zmiana kolejności",
  VIDEO_LAYOUT_SAVED: "Zapisany układ kanału",
  VIDEO_COVER_UPLOADED: "Nowa miniatura",
  VIDEO_SUBTITLES_UPLOADED: "Wgrane napisy",
  VIDEO_SUBTITLES_REMOVED: "Usunięte napisy",
  VIDEO_REENCODE_REQUESTED: "Zlecone ponowne kodowanie",
  VIDEO_ENCODE_REQUESTED: "Zlecone kodowanie",
  VIDEO_ENCODE_CANCELLED: "Anulowane kodowanie",
  VIDEO_ORIGINAL_UPLOADED: "Wgrany oryginał",
  VIDEO_ORIGINAL_UPLOAD_STARTED: "Rozpoczęte wgrywanie oryginału",
  VIDEO_HLS_ASSET_DELETED: "Usunięta wersja HLS",
  VIDEO_PUBLISH_AFTER_ASSET_READY_REQUESTED: "Publikacja po zakodowaniu: zlecona",
  VIDEO_PUBLISH_AFTER_ASSET_READY_COMPLETED: "Publikacja po zakodowaniu: wykonana",
};

export const auditLabel = (action: string) => AUDIT_LABEL[action] ?? action;

/** Who acted, in words: the panel and the old /admin both write "admin"; workers and crons write "system". */
export const auditActor = (actorType: string | null | undefined) => (actorType === "system" ? "system" : actorType === "admin" ? "administrator" : actorType ?? "—");
