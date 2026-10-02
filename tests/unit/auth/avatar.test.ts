import { describe, expect, it } from 'vitest';
import { validateAvatarFile, AVATAR_MAX_BYTES } from '@/lib/auth/avatar';

describe('validateAvatarFile', () => {
  it('accepts jpg/png/webp within the size limit', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: 'image/webp', size: 1 })).toBeNull();
  });
  it('rejects other types and oversized files', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(validateAvatarFile({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toBe('size');
  });
});
