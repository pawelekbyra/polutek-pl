import { logger } from "@/lib/logger";

type MetricValue = string | number | boolean | null | undefined;
type MetricFields = Record<string, MetricValue>;
type MetricLevel = "info" | "warn" | "error";

type RecordMetricOptions = {
  level?: MetricLevel;
  alert?: boolean;
};

function nowMs() {
  return Date.now();
}

function compactFields(fields: MetricFields = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function startTimer() {
  return nowMs();
}

export function elapsedMs(startedAt: number) {
  return Math.max(0, nowMs() - startedAt);
}

export function recordMetric(
  name: string,
  fields: MetricFields = {},
  options: RecordMetricOptions = {},
) {
  const level = options.level || (options.alert ? "warn" : "info");
  const payload = {
    metric: name,
    alert: Boolean(options.alert),
    ...compactFields(fields),
  };

  logger[level](`[METRIC] ${name}`, payload);
}

export function recordAlert(name: string, fields: MetricFields = {}) {
  recordMetric(name, fields, { level: "error", alert: true });
}

export function recordDurationMetric(
  name: string,
  startedAt: number,
  fields: MetricFields = {},
  options: RecordMetricOptions = {},
) {
  recordMetric(name, { ...fields, durationMs: elapsedMs(startedAt) }, options);
}
