# Video player mobile progress seek fix

## Problem

On mobile, tapping/clicking a point on the progress bar should immediately seek the video to that moment and move the filled progress + thumb dot to that exact position.

Current `PlayerTimeScrubber` in `app/components/VideoPlayer.tsx` seeks with `remote.seek(...)`, but the visual thumb/fill can lag or briefly snap back because the UI depends on `currentTime` and a fragile `pendingSeekTime` state.

## Desired behavior

- Pointer down/tap anywhere on the scrubber calculates the target time from `event.clientX`.
- The UI immediately sets local optimistic seek state to that time.
- The fill width and thumb position use that optimistic value right away.
- The player receives `remote.seek(clampedTime, getPlayerEvent(event))`.
- Once the real media `currentTime` catches up, optimistic state is cleared.
- Dragging should keep updating the same optimistic time continuously.
- Keyboard seek should keep working.

## Suggested implementation

In `PlayerTimeScrubber`, replace `pendingSeekTime` with `optimisticSeekTime` and use it in `displayTime`:

```tsx
const [optimisticSeekTime, setOptimisticSeekTime] = useState<number | null>(null);
const displayTime = isDragging ? dragTime : optimisticSeekTime ?? currentTime;
```

Clear it only after the player catches up and not while dragging:

```tsx
useEffect(() => {
    if (optimisticSeekTime === null || isDragging) return;

    const resolvedTime = Number.isFinite(currentTime) ? currentTime : 0;
    if (Math.abs(resolvedTime - optimisticSeekTime) < 0.35) {
        setOptimisticSeekTime(null);
    }
}, [currentTime, optimisticSeekTime, isDragging]);
```

In `seekToPointerTime`, set both `dragTime` and `optimisticSeekTime` before calling `remote.seek`:

```tsx
const clampedTime = Math.min(Math.max(nextTime, 0), safeDuration);
setDragTime(clampedTime);
setOptimisticSeekTime(clampedTime);
setDraggingState(keepDragging);
remote.seek(clampedTime, getPlayerEvent(event));
```

Also stop the pointer event from bubbling into the full-video tap target:

```tsx
onPointerDown={(event) => {
    const nextTime = getTimeFromPointer(event.clientX);
    if (nextTime === null) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    seekToPointerTime(nextTime, event, true);
}}
```

Do the same on `onPointerUp` before release/seek.

## UX note

This should be paired with the mobile controls proportional layout fix:

- mobile buttons around `h-9 w-9`, desktop remains `sm:h-11 sm:w-11`,
- mobile time readout around `min-w-[5.75rem] text-[12px]`, desktop remains `sm:min-w-[8.5rem] sm:text-[15px]`,
- scrubber hit target stays large, visual track remains compact,
- volume slider remains hidden until desktop/tablet width.

## Acceptance

- Tap/click on 25%, 50%, 75% of progress bar immediately moves the dot and fill there.
- Video seeks to the same moment.
- Dot does not jump back before media catches up.
- Drag seek remains smooth.
- Play/pause tap target does not intercept progress bar taps.
- Existing accessibility role/keyboard behavior remains intact.
