type EnvLike = Record<string, string | undefined>;

const HTTPS_SCHEME = 'https:';

function parseConfiguredHosts(value?: string) {
  if (!value) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        const parsed = new URL(entry.includes('://') ? entry : `https://${entry}`);
        return parsed.protocol === HTTPS_SCHEME ? parsed.host : null;
      } catch {
        return null;
      }
    })
    .filter((host): host is string => Boolean(host));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function hostsToSources(hosts: string[]) {
  return unique(hosts).map((host) => `https://${host}`);
}

export function resolveCspMediaHosts(env: EnvLike = process.env) {
  return unique([
    ...parseConfiguredHosts(env.MEDIA_BUCKET_HOST),
    ...parseConfiguredHosts(env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseConfiguredHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseConfiguredHosts(env.ALLOWED_MEDIA_HOSTS),
  ]);
}

export function resolveCspImageHosts(env: EnvLike = process.env) {
  return unique([
    ...resolveCspMediaHosts(env),
    ...parseConfiguredHosts(env.ALLOWED_THUMBNAIL_HOSTS),
    ...parseConfiguredHosts(env.ALLOWED_COMMENT_IMAGE_HOSTS),
    ...parseConfiguredHosts(env.ALLOWED_AVATAR_HOSTS),
  ]);
}

export function buildContentSecurityPolicy(env: EnvLike = process.env) {
  const mediaSources = hostsToSources(resolveCspMediaHosts(env));
  const configuredImageSources = hostsToSources(resolveCspImageHosts(env));
  const clerkSources = ['https://clerk.com', 'https://*.clerk.accounts.dev'];
  const imageSources = unique([
    ...configuredImageSources,
    'https://img.clerk.com',
    'https://images.clerk.com',
    'https://api.dicebear.com',
  ]);

  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'", ...clerkSources, 'https://js.stripe.com', "'unsafe-inline'", "'unsafe-eval'"],
    ["script-src-elem", "'self'", ...clerkSources, 'https://js.stripe.com', "'unsafe-inline'"],
    ["connect-src", "'self'", ...clerkSources, 'https://api.stripe.com', ...mediaSources],
    ["frame-src", 'https://js.stripe.com', 'https://*.clerk.accounts.dev'],
    ["img-src", "'self'", 'data:', 'blob:', ...imageSources],
    ["style-src", "'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    ["style-src-elem", "'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    ["font-src", "'self'", 'data:', 'https://fonts.gstatic.com'],
    ["worker-src", "'self'", 'blob:'],
    ["media-src", "'self'", 'blob:', ...mediaSources],
  ];

  return directives.map((directive) => directive.join(' ')).join('; ');
}
