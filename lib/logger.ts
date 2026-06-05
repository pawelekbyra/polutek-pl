type LogLevel = "debug" | "info" | "warn" | "error";

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

const isDebugEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEBUG_LOGS === "true";
const sensitiveKeyPattern = /(authorization|cookie|password|secret|signature|token|webhook|api[_-]?key|client[_-]?secret|card|cvc)/i;
const sensitiveValuePattern = /(sk_live|sk_test|pk_live|rk_live|whsec|clerk_secret|bearer\s+)[A-Za-z0-9_\-.]+/gi;

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.search) url.search = "?redacted=1";
    if (url.username) url.username = "redacted";
    if (url.password) url.password = "redacted";
    return url.toString();
  } catch {
    return value.replace(sensitiveValuePattern, "$1[REDACTED]");
  }
}

function redactString(value: string) {
  const redactedSecrets = value.replace(sensitiveValuePattern, "$1[REDACTED]");
  return redactedSecrets.replace(/https?:\/\/\S+/g, (match) => redactUrl(match));
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): JsonLike | undefined {
  if (value === null) return null;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "symbol" || typeof value === "function") return undefined;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (value instanceof URL) return redactUrl(value.toString());

  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value.map((item) => sanitizeValue(item, seen) ?? null);
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    const sanitized: { [key: string]: JsonLike } = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sensitiveKeyPattern.test(key)
        ? "[REDACTED]"
        : sanitizeValue(raw, seen) ?? null;
    }
    return sanitized;
  }

  return String(value);
}

function sanitizeArgs(args: unknown[]) {
  const seen = new WeakSet<object>();
  return args.map((arg) => sanitizeValue(arg, seen));
}

function log(level: LogLevel, args: unknown[]) {
  if (level === "debug" && !isDebugEnabled) return;

  const prefix = `[${level.toUpperCase()}]`;
  const sanitizedArgs = sanitizeArgs(args);
  if (level === "error") {
    console.error(prefix, ...sanitizedArgs);
    return;
  }
  if (level === "warn") {
    console.warn(prefix, ...sanitizedArgs);
    return;
  }
  if (level === "debug") {
    console.debug(prefix, ...sanitizedArgs);
    return;
  }
  console.info(prefix, ...sanitizedArgs);
}

/**
 * Returns a logger with correlation ID bound to its output.
 */
export function createScopedLogger(requestId: string | null) {
    const idSuffix = requestId ? ` [RID:${requestId}]` : '';
    return {
        debug: (...args: unknown[]) => log("debug", [`${args[0]}${idSuffix}`, ...args.slice(1)]),
        info: (...args: unknown[]) => log("info", [`${args[0]}${idSuffix}`, ...args.slice(1)]),
        warn: (...args: unknown[]) => log("warn", [`${args[0]}${idSuffix}`, ...args.slice(1)]),
        error: (...args: unknown[]) => log("error", [`${args[0]}${idSuffix}`, ...args.slice(1)]),
    };
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", args),
  info: (...args: unknown[]) => log("info", args),
  warn: (...args: unknown[]) => log("warn", args),
  error: (...args: unknown[]) => log("error", args),
};
