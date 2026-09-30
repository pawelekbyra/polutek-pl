import { describe, expect, it, vi } from 'vitest';
import { applyAvatar, validateAvatarFile, AVATAR_MAX_BYTES } from '@/lib/auth/avatar';

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

describe('applyAvatar', () => {
  it('uploads the chosen file', async () => {
    const setProfileImage = vi.fn().mockResolvedValue({});
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await applyAvatar({ setProfileImage }, file);
    expect(setProfileImage).toHaveBeenCalledWith({ file });
  });
  it('falls back to the default avatar when nothing was chosen', async () => {
    const blob = new Blob(['default'], { type: 'image/jpeg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => blob }));
    const setProfileImage = vi.fn().mockResolvedValue({});
    await applyAvatar({ setProfileImage }, null);
    expect(fetch).toHaveBeenCalledWith('/default-avatar.jpg');
    expect(setProfileImage).toHaveBeenCalledWith({ file: blob });
    vi.unstubAllGlobals();
  });
  it('never throws when Clerk fails', async () => {
    const setProfileImage = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(applyAvatar({ setProfileImage }, new File(['x'], 'a.png', { type: 'image/png' }))).resolves.toBeUndefined();
    await expect(applyAvatar(null, null)).resolves.toBeUndefined();
  });
});
