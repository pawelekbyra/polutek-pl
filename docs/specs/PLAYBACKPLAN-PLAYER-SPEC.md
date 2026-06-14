# PLAYBACKPLAN-PLAYER-SPEC: Secure Video Delivery

Status: ACTIVE
Launch status: **NO_GO**

## 1. PlaybackPlan Invariant

A `PlaybackPlan` MUST follow a strict discriminated union to prevent inconsistent player states.

```txt
READY iff (canPlay === true AND access.allowed === true AND playable source exists)
```

## 2. Provider Gating

- **Order of Operations**: Authenticate -> AccessDecision -> Asset Readiness -> Provider Resolution -> Signed Source -> READY.
- **Security**: Zero provider calls or signed tokens if access is denied.
- **Redaction**: No provider asset IDs, raw storage URLs, or tokens in denied responses.

## 3. Frontend Boundary

- No `<video>` or iframe rendered if `PlaybackPlan.canPlay` is false.
- No analytics or heartbeats for denied sessions.
- Private personalized responses MUST be non-cacheable (`private, no-store, max-age=0`).
- Locked states are distinct render branches, not overlays.

## 4. Required Evidence
- Network trace showing zero provider requests on denied access.
- DOM inspection showing zero player components on denied access.
- Correct `Cache-Control` headers for token responses.
