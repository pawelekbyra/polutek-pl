# PLAYBACKPLAN-PLAYER-SPEC: Secure Video Delivery

Status: ACTIVE
Launch status: **NO_GO**

## 1. PlaybackPlan Invariant

A `PlaybackPlan` MUST follow a strict discriminated union to prevent inconsistent player states.

```txt
READY iff (canPlay === true AND access.allowed === true AND source exists)
```

## 2. Provider Gating

- **Order of Operations**: Authenticate -> AccessDecision -> Asset Readiness -> Provider Resolution -> Signed Source -> READY.
- **Security**: Zero provider calls or signed tokens if access is denied.

## 3. Frontend Boundary

- No `<video>` or iframe rendered if `PlaybackPlan.canPlay` is false.
- No analytics or heartbeats for denied sessions.
- Private personalized responses MUST be non-cacheable.
