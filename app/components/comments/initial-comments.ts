/**
 * The first page of a video's comments, rendered on the server with the page (HomeExperience), in
 * exactly the JSON shape `GET /api/comments` returns. The browser seeds its comments cache with it,
 * so the list is in the first HTML instead of a skeleton waiting for that request.
 */
export type InitialCommentsPage = {
  videoId: string;
  sortBy: "newest";
  // The API's JSON as-is; useComments reads it like any fetched page.
  page: Record<string, unknown>;
};
