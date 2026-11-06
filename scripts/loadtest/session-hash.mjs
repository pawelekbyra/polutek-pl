// Run inside the app container. Only the keyed hash leaves the container; neither secret is printed.
import crypto from "node:crypto";

const userAgent = process.env.LOADTEST_USER_AGENT;
if (!userAgent || !/^pp-loadtest\/[0-9a-f-]{36}$/.test(userAgent)) {
  console.error("invalid load-test user-agent identity");
  process.exit(2);
}

const explicit = process.env.IP_HASH_SECRET?.trim();
const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
const derived = authSecret
  ? crypto.createHmac("sha256", authSecret).update("pawelperfect/ip-hash/v1").digest("hex")
  : null;
const productionRequiresSecret = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
const secret = explicit || derived || (!productionRequiresSecret ? "dev-only-ip-hash-secret-0123456789abcdef" : null);
if (!secret) {
  console.error("app container has no client-hash secret");
  process.exit(3);
}

process.stdout.write(crypto.createHmac("sha256", secret).update(userAgent).digest("hex") + "\n");
