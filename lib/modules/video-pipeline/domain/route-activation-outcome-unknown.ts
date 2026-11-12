/** The database could not confirm whether route activation committed; preserve this attempt's HLS objects. */
export class RouteActivationOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super("Could not determine whether HLS route activation committed; preserving the encode output for retry.", { cause });
    this.name = "RouteActivationOutcomeUnknownError";
  }
}
