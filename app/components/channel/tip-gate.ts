// Hidden since 2026-10-21, kept on purpose: the tip gate (SupportModal and app/components/support/*, the tip path of
// createCheckoutIntent, /api/checkout/create-intent) is no longer reachable from the UI. The gold "Kup se Premium"
// button opens the patron checkout (app/components/premium-pass) instead. Several app/components/support/* parts
// (TipPayStep, TipPayFrame, TipSelect, ...) are shared with that checkout and stay live. Setting this to true re-attaches the
// "polutek:open-support" event, the ?support=1 deep link and the Stripe return handling in ChannelHome; nothing else
// in the UI dispatches that event any more.
export const TIP_GATE_ENABLED = false;
