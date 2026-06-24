# PR #1097 completion — UX/accessibility loading, locked, and error states

Status: DONE

PR #1097 was created by Jules and merged after CI passed.

## What changed

- Unified player loading through `PlayerLoadingState.tsx` and `PremiumWrapper` ownership of the loading surface.
- Reworked locked/access overlays so login and patron-required states expose visible, accessible CTAs.
- Removed per-thumbnail `PremiumWrapper` usage from the sidebar playlist to avoid unnecessary media-source calls and flicker.
- Improved comments loading, skeleton behavior, reduced-motion handling, support-box navigation, and the no-video fallback state.

## Validation

- GitHub CI for the PR head completed successfully before merge.

## Notes

- This is a UI/accessibility completion note only.
- It does not close the remaining security/authorization cleanup workstreams.
