const hasRemoteTarget = Boolean(process.env.E2E_BASE_URL);
const requiredForLocalServer = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'DATABASE_URL',
];

const missing = hasRemoteTarget
  ? []
  : requiredForLocalServer.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error('E2E smoke requires either E2E_BASE_URL for a deployed/staging app or local runtime env.');
  console.error(`Missing local env: ${missing.join(', ')}`);
  console.error('Use Vercel/staging secrets, or run with E2E_BASE_URL=https://your-preview-url.example.');
  process.exit(1);
}
