export type ApiErrorBody = {
  success?: false;
  error?: string;
  message?: string;
};

export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null) as ApiErrorBody | T | null;
  const errorBody = data as ApiErrorBody | null;

  if (!res.ok || errorBody?.success === false) {
    const message =
      errorBody?.message ||
      errorBody?.error ||
      `Request failed with status ${res.status}`;

    throw new Error(message);
  }

  return data as T;
}
