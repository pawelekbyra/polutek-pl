import { describe, expect, it } from 'vitest';
import {
  MalformedFormDataBodyError,
  MalformedJsonBodyError,
  RequestBodyTooLargeError,
  TooManyFormEntriesError,
  readRequestBytesWithLimit,
  readRequestFormDataWithLimit,
  readRequestJsonWithLimit,
  readRequestTextWithLimit,
} from '@/lib/utils/request-body';
import { adminMultipartCompleteSchema, ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES } from '@/lib/api/admin-schemas';
import { readStudioJson } from '@/lib/api/studio-route';

function streamedRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
) {
  let index = 0;
  let suppliedBytes = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (!chunk) return controller.close();
      suppliedBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request('http://fixture.invalid/body', {
    method: 'POST',
    headers,
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  return { request, get suppliedBytes() { return suppliedBytes; }, get cancelled() { return cancelled; } };
}

describe('bounded request body readers', () => {
  it('rejects an oversized declared length without reading or parsing the body', async () => {
    const input = streamedRequest([new TextEncoder().encode('{"ok":true}')], { 'content-length': '12' });
    await expect(readRequestJsonWithLimit(input.request, 11)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(input.suppliedBytes).toBe(0);
  });

  it.each([
    ['missing content length', {}],
    ['understated content length', { 'content-length': '1' }],
  ])('stops a streamed body at the first over-limit chunk with %s', async (_name, headers) => {
    const input = streamedRequest([
      new TextEncoder().encode('1234'),
      new TextEncoder().encode('5678'),
      new TextEncoder().encode('9abc'),
    ], headers);
    await expect(readRequestBytesWithLimit(input.request, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(input.suppliedBytes).toBe(12);
    expect(input.cancelled).toBe(true);
  });

  it('accepts exactly the byte limit and decodes split UTF-8 correctly', async () => {
    const encoded = new TextEncoder().encode('{"value":"żółć"}');
    const input = streamedRequest([encoded.subarray(0, 7), encoded.subarray(7)]);
    await expect(readRequestJsonWithLimit(input.request, encoded.byteLength)).resolves.toEqual({ value: 'żółć' });

    const textInput = streamedRequest([encoded]);
    await expect(readRequestTextWithLimit(textInput.request, encoded.byteLength)).resolves.toBe('{"value":"żółć"}');
  });

  it('preserves bytes across bounded buffer slabs and arbitrary stream chunk boundaries', async () => {
    const expected = new Uint8Array(64 * 1024 + 7).fill(0x61);
    const input = streamedRequest([expected.subarray(0, 65_535), expected.subarray(65_535)]);

    await expect(readRequestBytesWithLimit(input.request, expected.byteLength)).resolves.toEqual(expected);
  });

  it('reports malformed JSON separately from an oversized payload', async () => {
    const input = streamedRequest([new TextEncoder().encode('{')]);
    await expect(readRequestJsonWithLimit(input.request, 8)).rejects.toBeInstanceOf(MalformedJsonBodyError);
  });

  it('bounds multipart bytes before parsing and rejects excessive fields', async () => {
    const form = new FormData();
    form.set('file', new File(['abc'], 'a.txt', { type: 'text/plain' }));
    form.set('extra', 'x');
    const encoded = new Request('http://fixture.invalid/encode', { method: 'POST', body: form });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const input = streamedRequest([bytes], { 'content-type': encoded.headers.get('content-type')! });

    await expect(readRequestFormDataWithLimit(input.request, bytes.byteLength, 1)).rejects.toBeInstanceOf(TooManyFormEntriesError);
  });

  it('accepts a multipart body at its exact byte limit', async () => {
    const form = new FormData();
    form.set('file', new File(['abc'], 'a.txt', { type: 'text/plain' }));
    const encoded = new Request('http://fixture.invalid/encode', { method: 'POST', body: form });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const input = streamedRequest([bytes], { 'content-type': encoded.headers.get('content-type')! });

    const parsed = await readRequestFormDataWithLimit(input.request, bytes.byteLength, 1);
    expect((parsed.get('file') as File).size).toBe(3);
  });

  it('rejects oversized multipart bytes before attempting to parse malformed parts', async () => {
    const input = streamedRequest([new TextEncoder().encode('x'.repeat(2048))], {
      'content-type': 'multipart/form-data; boundary=fixture',
    });
    await expect(readRequestFormDataWithLimit(input.request, 1024, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(input.cancelled).toBe(true);
  });

  it('rejects malformed multipart data', async () => {
    const input = streamedRequest([new TextEncoder().encode('not a multipart body')], {
      'content-type': 'multipart/form-data; boundary=fixture',
    });
    await expect(readRequestFormDataWithLimit(input.request, 128, 4)).rejects.toBeInstanceOf(MalformedFormDataBodyError);
  });

  it('counts multipart sections before invoking the native parser', async () => {
    const body = '--b\r\nnot-a-header\r\n\r\none\r\n--b\r\nnot-a-header\r\n\r\ntwo\r\n--b--\r\n';
    const input = streamedRequest([new TextEncoder().encode(body)], {
      'content-type': 'multipart/form-data; boundary=b',
    });
    await expect(readRequestFormDataWithLimit(input.request, 256, 1)).rejects.toBeInstanceOf(TooManyFormEntriesError);
  });

  it('keeps 10,000 parts with worst-case visible ETag escaping within the proxy-safe body budget', async () => {
    const nextConfig = (await import('../../../next.config.mjs')).default as {
      experimental?: { proxyClientMaxBodySize?: string };
    };
    expect(nextConfig.experimental?.proxyClientMaxBodySize).toBe('7mb');
    expect(ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES).toBeLessThan(7 * 1024 * 1024);
    const body = JSON.stringify({
      originalId: 'o'.repeat(64),
      parts: Array.from({ length: 10_000 }, (_, index) => ({ partNumber: index + 1, etag: '\\'.repeat(200) })),
      publishAfterReady: true,
    });
    const bodyBytes = new TextEncoder().encode(body).byteLength;
    expect(bodyBytes).toBeGreaterThan(4 * 1024 * 1024);
    expect(bodyBytes).toBeLessThan(ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES);
    const request = new Request('http://fixture.invalid/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    const result = await readStudioJson(request, adminMultipartCompleteSchema, ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.parts).toHaveLength(10_000);
  });

  it('returns 413 before schema parsing when a streamed Studio JSON body exceeds its cap', async () => {
    let parsed = false;
    const input = streamedRequest([new Uint8Array(16), new Uint8Array(16)], { 'content-type': 'application/json' });
    const result = await readStudioJson(input.request, {
      safeParse() { parsed = true; return { success: true as const, data: {} }; },
    }, 16);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
    expect(parsed).toBe(false);
    expect(input.cancelled).toBe(true);
  });
});
