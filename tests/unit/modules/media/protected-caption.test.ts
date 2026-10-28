import { describe, expect, it } from 'vitest';
import {
  CAPTION_DEFAULT_BUCKET,
  captionDeliveryPath,
  captionFileName,
  captionObjectKey,
  formatCaptionRef,
  isCaptionKeyOf,
  parseCaptionRef,
} from '@/lib/modules/media';
import { DEFAULT_HLS_BUCKET } from '@/lib/modules/video-pipeline/domain/keys';

const VIDEO = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const HASH = '0123456789abcdef'.repeat(4);

describe('protected caption references', () => {
  it('round-trips a reference and builds the private key and delivery path', () => {
    const file = captionFileName('pl', HASH);
    expect(file).toBe(`pl-${HASH}.vtt`);
    const ref = formatCaptionRef(file);
    expect(ref).toBe(`hlscap:pl-${HASH}.vtt`);
    expect(parseCaptionRef(ref)).toEqual({ file, lang: 'pl', hash: HASH });
    expect(captionObjectKey(VIDEO, file)).toBe(`videos/${VIDEO}/captions/${file}`);
    expect(captionDeliveryPath(file)).toBe(`captions/${file}`);
  });

  it('is not a URL: only the exact reference shape parses', () => {
    for (const bad of [null, undefined, '', 'https://thumbs.example.com/videos/x/subtitles/a.vtt', '/subtitles/a/pl.vtt', 'hlscap:', 'hlscap:pl-abc.vtt', `hlscap:../pl-${HASH}.vtt`, `hlscap:pl-${HASH}.vtt?x=1`, `hlscap:PL-${HASH}.vtt`, `hlscap:pl-${HASH.toUpperCase()}.vtt`]) {
      expect(parseCaptionRef(bad as string)).toBeNull();
    }
    expect(() => captionFileName('p/l', HASH)).toThrow();
    expect(() => captionObjectKey('../x', `pl-${HASH}.vtt`)).toThrow();
  });

  it('only recognises keys of the same video as deletable captions', () => {
    const key = captionObjectKey(VIDEO, `pl-${HASH}.vtt`);
    expect(isCaptionKeyOf(VIDEO, key)).toBe(true);
    expect(isCaptionKeyOf('another-video-id', key)).toBe(false);
    expect(isCaptionKeyOf(VIDEO, `videos/${VIDEO}/v/v1/master.m3u8`)).toBe(false);
    expect(isCaptionKeyOf(VIDEO, `videos/${VIDEO}/captions/`)).toBe(false);
    expect(isCaptionKeyOf(VIDEO, `videos/${VIDEO}/captions/../v/v1/x.vtt`)).toBe(false);
  });

  it('uses the same default bucket as the HLS pipeline', () => {
    expect(CAPTION_DEFAULT_BUCKET).toBe(DEFAULT_HLS_BUCKET);
  });
});
