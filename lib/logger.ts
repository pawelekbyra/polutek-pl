type LogLevel = "debug" | "info" | "warn" | "error";

const isDebugEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEBUG_LOGS === "true";

function log(level: LogLevel, args: unknown[]) {
  if (level === "debug" && !isDebugEnabled) return;

  const prefix = `[${level.toUpperCase()}]`;
  if (level === "error") {
    console.error(prefix, ...args);
    return;
  }
  if (level === "warn") {
    console.warn(prefix, ...args);
    return;
  }
  if (level === "debug") {
    console.debug(prefix, ...args);
    return;
  }
  console.info(prefix, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", args),
  info: (...args: unknown[]) => log("info", args),
  warn: (...args: unknown[]) => log("warn", args),
  error: (...args: unknown[]) => log("error", args),
};
