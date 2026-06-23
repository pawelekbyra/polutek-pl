export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes.`);
    this.name = 'RequestBodyTooLargeError';
  }
}

export class MalformedJsonBodyError extends Error {
  constructor() {
    super('Malformed JSON request body.');
    this.name = 'MalformedJsonBodyError';
  }
}

function getContentLengthBytes(req: Request) {
  const contentLength = req.headers.get('content-length');
  if (!contentLength) return null;

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function readRequestTextWithLimit(req: Request, maxBytes: number) {
  const declaredBytes = getContentLengthBytes(req);
  if (declaredBytes !== null && declaredBytes > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!req.body) return '';

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function readRequestJsonWithLimit<T>(req: Request, maxBytes: number): Promise<T> {
  const text = await readRequestTextWithLimit(req, maxBytes);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MalformedJsonBodyError();
  }
}
