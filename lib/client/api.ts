export type ApiErrorBody = {
  success?: false;
  error?: string;
  message?: string;
  code?: string;
};

/** A failed API call: `message` is for logs (the server's text); UI code maps `code`/`status` to its own translated text. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null) as ApiErrorBody | T | null;
  const errorBody = data as ApiErrorBody | null;

  if (!res.ok || errorBody?.success === false) {
    const message =
      errorBody?.message ||
      errorBody?.error ||
      `Request failed with status ${res.status}`;

    throw new ApiRequestError(message, res.status, typeof errorBody?.code === "string" ? errorBody.code : undefined);
  }

  return data as T;
}
