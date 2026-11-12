export class RequestBodyTooLargeError extends Error {
  maxBytes: number;

  constructor(maxBytes: number) {
    super(`Payload exceeds ${maxBytes} bytes.`);
    this.name = 'RequestBodyTooLargeError';
    this.maxBytes = maxBytes;
  }
}

export class MalformedJsonBodyError extends Error {
  constructor() {
    super('Malformed JSON.');
    this.name = 'MalformedJsonBodyError';
  }
}

export class MalformedFormDataBodyError extends Error {
  constructor() {
    super('Malformed multipart form data.');
    this.name = 'MalformedFormDataBodyError';
  }
}

export class TooManyFormEntriesError extends Error {
  maxEntries: number;

  constructor(maxEntries: number) {
    super(`Multipart body exceeds ${maxEntries} fields.`);
    this.name = 'TooManyFormEntriesError';
    this.maxEntries = maxEntries;
  }
}

export const DEFAULT_JSON_BODY_MAX_BYTES = 128 * 1024;

function getContentLengthBytes(req: Request): number | null {
  const contentLength = req.headers.get('content-length');
  if (contentLength === null || !/^\d+$/.test(contentLength)) return null;

  const parsed = Number(contentLength);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function readRequestTextWithLimit(req: Request, maxBytes: number): Promise<string> {
  const bytes = await readRequestBytesWithLimit(req, maxBytes);
  return new TextDecoder().decode(bytes);
}

/** Reads a request body in bounded chunks. The declared length is an early rejection hint; streamed bytes are authoritative. */
export async function readRequestBytesWithLimit(req: Request, maxBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('maxBytes must be a non-negative safe integer.');
  const declaredBytes = getContentLengthBytes(req);
  if (declaredBytes !== null && declaredBytes > maxBytes) {
    try { await req.body?.cancel(); } catch { /* the upstream may already own or have cancelled the body */ }
    throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  const slabBytes = 64 * 1024;
  let current = new Uint8Array(Math.min(maxBytes, slabBytes));
  let currentBytes = 0;
  let allocatedBytes = 0;
  let receivedBytes = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;

    const value = chunk.value;
    if (value.byteLength > maxBytes - receivedBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError(maxBytes);
    }

    let valueOffset = 0;
    while (valueOffset < value.byteLength) {
      if (currentBytes === current.byteLength) {
        chunks.push(current);
        allocatedBytes += current.byteLength;
        current = new Uint8Array(Math.min(slabBytes, maxBytes - allocatedBytes));
        currentBytes = 0;
      }
      const copiedBytes = Math.min(value.byteLength - valueOffset, current.byteLength - currentBytes);
      current.set(value.subarray(valueOffset, valueOffset + copiedBytes), currentBytes);
      currentBytes += copiedBytes;
      valueOffset += copiedBytes;
    }
    receivedBytes += value.byteLength;
  }

  const bytes = new Uint8Array(receivedBytes);
  let outputOffset = 0;
  for (const part of chunks) {
    bytes.set(part, outputOffset);
    outputOffset += part.byteLength;
  }
  bytes.set(current.subarray(0, currentBytes), outputOffset);
  return bytes;
}

export async function readRequestJsonWithLimit<T>(req: Request, maxBytes: number): Promise<T> {
  const text = await readRequestTextWithLimit(req, maxBytes);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MalformedJsonBodyError();
  }
}

/** Parses optional or schema-validated JSON without allowing malformed JSON to bypass the byte limit. */
export async function readRequestJsonOrNullWithLimit(req: Request, maxBytes = DEFAULT_JSON_BODY_MAX_BYTES): Promise<unknown | null> {
  try {
    return await readRequestJsonWithLimit<unknown>(req, maxBytes);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    return null;
  }
}

/** Reads bounded multipart bytes before handing them to the platform FormData parser. */
export async function readRequestFormDataWithLimit(
  req: Request,
  maxBytes: number,
  maxEntries: number,
): Promise<FormData> {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 0) throw new RangeError('maxEntries must be a non-negative safe integer.');
  const bytes = await readRequestBytesWithLimit(req, maxBytes);
  const contentType = req.headers.get('content-type') ?? '';
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  let entries: number;
  if (mediaType === 'multipart/form-data') {
    const boundary = contentType.match(/(?:^|;)\s*boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
    const boundaryText = boundary?.[1] ?? boundary?.[2];
    if (!boundaryText || boundaryText.length > 70) throw new MalformedFormDataBodyError();
    entries = countMultipartEntries(bytes, new TextEncoder().encode(`--${boundaryText}`));
  } else if (mediaType === 'application/x-www-form-urlencoded') {
    entries = bytes.byteLength === 0 ? 0 : 1;
    for (const byte of bytes) if (byte === 0x26) entries += 1; // '&' separates fields; escaped values use %26.
  } else {
    throw new MalformedFormDataBodyError();
  }
  if (entries > maxEntries) throw new TooManyFormEntriesError(maxEntries);

  const headers = new Headers(req.headers);
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  let form: FormData;
  try {
    form = await new Request(req.url, { method: 'POST', headers, body }).formData();
  } catch {
    throw new MalformedFormDataBodyError();
  }

  return form;
}

/** Counts syntactic multipart part delimiters before the native parser reads any fields or files. */
function countMultipartEntries(body: Uint8Array, delimiter: Uint8Array): number {
  let count = 0;
  const prefix = new Int32Array(delimiter.byteLength);
  for (let i = 1, matched = 0; i < delimiter.byteLength; i++) {
    while (matched > 0 && delimiter[i] !== delimiter[matched]) matched = prefix[matched - 1];
    if (delimiter[i] === delimiter[matched]) matched += 1;
    prefix[i] = matched;
  }

  for (let i = 0, matched = 0; i < body.byteLength; i++) {
    while (matched > 0 && body[i] !== delimiter[matched]) matched = prefix[matched - 1];
    if (body[i] === delimiter[matched]) matched += 1;
    if (matched !== delimiter.byteLength) continue;

    const found = i - delimiter.byteLength + 1;
    const atLineStart = found === 0 || (found >= 2 && body[found - 2] === 0x0d && body[found - 1] === 0x0a);
    const after = found + delimiter.byteLength;
    if (atLineStart) {
      let suffix = after;
      while (body[suffix] === 0x20 || body[suffix] === 0x09) suffix += 1; // MIME transport padding.
      if (body[suffix] === 0x0d && body[suffix + 1] === 0x0a) count += 1;
    }
    matched = prefix[matched - 1];
  }
  return count;
}
