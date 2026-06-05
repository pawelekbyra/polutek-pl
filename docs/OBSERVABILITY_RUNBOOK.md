# Observability and alert contract for private beta

This repo emits log-based metrics with the `[METRIC]` prefix so the first private beta can be monitored without adding a vendor SDK. The hosting platform should route these structured log lines into dashboards and alerts before beta traffic is invited.

## Metric log format

Metric events are emitted through `lib/observability.ts` and go through the shared logger sanitizer. Secret-like keys, webhook signatures, tokenized URLs, and signed media URLs are redacted before output.

Every metric payload includes:

- `metric` — stable metric name,
- `alert` — `true` for signals that should page or notify,
- flow-specific dimensions such as `eventType`, `status`, `durationMs`, `host`, or `requiredTier`.

## Required beta dashboards

Create dashboard panels or saved log queries for:

- Stripe webhook processing duration: `stripe.webhook.processing_time`, `stripe.webhook.request`.
- Stripe idempotency health: `stripe.webhook.duplicate_event`, `stripe.webhook.lock_conflict`, `stripe.webhook.lock_acquired`.
- Money and access regressions: `payment.failure`, `payment.refund_received`, `payment.refund_cas_conflict`, `payment.dispute_opened`, `payment.dispute_lost`.
- Clerk webhook health: `clerk.webhook.processing_time`, `clerk.webhook.failed`, `clerk.webhook.duplicate_or_processing`.
- Media access health: `media_source.access_denied`, `media_source.rate_limited`, `media_proxy.access_denied`, `media_proxy.upstream_error`, `media_proxy.fetch_exception`.

## Required beta alerts

Before inviting beta users, configure alerts for these `[METRIC]` lines with `alert:true`:

- Any `stripe.webhook.request_failed` or failed `stripe.webhook.processing_time` event.
- Any `clerk.webhook.failed` event.
- Any `payment.failure`, `payment.refund_cas_conflict`, `payment.dispute_opened`, or `payment.dispute_lost` event.
- Spikes of `media_source.rate_limited`, `media_proxy.upstream_error`, or `media_proxy.fetch_exception`.
- Repeated `stripe.webhook.lock_conflict`, because stale processing locks can hide payment fulfillment regressions.

## Release evidence

For a beta release candidate, attach screenshots or links for the dashboard panels and alert policies to the release notes. The roadmap remains open until those remote artifacts exist in staging/prod-like infrastructure.
