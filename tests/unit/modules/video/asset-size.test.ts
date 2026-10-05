import { describe, expect, it } from 'vitest';
import { assetSizeToNumber } from '@/lib/modules/video/domain/asset-size';

describe('assetSizeToNumber (VideoAsset.sizeBytes is a BigInt column)', () => {
  it('converts bigint sizes, including above 2 GiB, to a JSON-safe number', () => {
    expect(assetSizeToNumber(123456n)).toBe(123456);
    expect(assetSizeToNumber(5n * 1024n ** 3n)).toBe(5 * 1024 ** 3);
    expect(() => JSON.stringify({ size: assetSizeToNumber(5n * 1024n ** 3n) })).not.toThrow();
  });
  it('maps missing and unsafe values to null', () => {
    expect(assetSizeToNumber(null)).toBeNull();
    expect(assetSizeToNumber(undefined)).toBeNull();
    expect(assetSizeToNumber(-1n)).toBeNull();
    expect(assetSizeToNumber(2n ** 60n)).toBeNull();
    expect(assetSizeToNumber(Number.NaN)).toBeNull();
  });
  it('passes plain numbers through', () => {
    expect(assetSizeToNumber(1234)).toBe(1234);
  });
});
