import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

/**
 * Creates a child logger with specific context.
 */
export function getContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
