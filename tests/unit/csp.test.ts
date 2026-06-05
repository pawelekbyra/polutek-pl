import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, resolveCspImageHosts, resolveCspMediaHosts } from '@/lib/security/csp';

describe('content security policy host resolution', () => {
  it('uses exact configured media and image hosts without broad provider wildcards', () => {
    const env = {
      MEDIA_BUCKET_HOST: 'https://media.example.com/path',
      NEXT_PUBLIC_R2_PUBLIC_HOST: 'bucket.example.r2.dev',
      NEXT_PUBLIC_BLOB_PUBLIC_HOST: 'blob.example.com',
      ALLOWED_MEDIA_HOSTS: 'cdn.example.com,assets.example.com',
      ALLOWED_THUMBNAIL_HOSTS: 'thumbs.example.com',
      ALLOWED_AVATAR_HOSTS: 'avatars.example.com',
    };

    expect(resolveCspMediaHosts(env)).toEqual([
      'media.example.com',
      'bucket.example.r2.dev',
      'blob.example.com',
      'cdn.example.com',
      'assets.example.com',
    ]);
    expect(resolveCspImageHosts(env)).toContain('thumbs.example.com');
    expect(resolveCspImageHosts(env)).toContain('avatars.example.com');

    const csp = buildContentSecurityPolicy(env);
    expect(csp).toContain('https://cdn.example.com');
    expect(csp).toContain('https://thumbs.example.com');
    expect(csp).not.toContain('https://*.r2.dev');
    expect(csp).not.toContain('https://*.vercel-storage.com');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
  });
});
