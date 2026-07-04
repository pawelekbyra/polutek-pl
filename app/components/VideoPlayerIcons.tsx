import React from "react";

// Player control icons drawn from scratch in the site's hand-drawn ("cienkopis") style, matching
// the like/share icon set. Stroke uses currentColor so the player can tint them; round caps/joins
// give the slightly organic feel. YouTube-equivalent shapes: filled play, twin-bar pause,
// speaker+waves volume, speaker+X mute, CC captions box, and corner-bracket fullscreen.

type IconProps = { className?: string };

const VB = "0 0 24 24";
const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox={VB} aria-hidden="true">
      <path
        d="M7.4 5.1 C7.4 4.4 8.1 4 8.7 4.4 L18.7 11.1 C19.3 11.5 19.3 12.5 18.7 12.9 L8.7 19.6 C8.1 20 7.4 19.6 7.4 18.9 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox={VB} aria-hidden="true">
      <path d="M8.5 5 L8.4 19" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <path d="M15.5 5 L15.6 19" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
    </svg>
  );
}

export function VolumeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox={VB} aria-hidden="true">
      <path d="M4 9.3 H7 L11.5 5.6 V18.4 L7 14.7 H4 Z" {...common} />
      <path d="M15 9 C16.7 10.7 16.7 13.3 15 15" {...common} />
      <path d="M17.6 6.4 C20.6 9.1 20.6 14.9 17.6 17.6" {...common} />
    </svg>
  );
}

export function MuteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox={VB} aria-hidden="true">
      <path d="M4 9.3 H7 L11.5 5.6 V18.4 L7 14.7 H4 Z" {...common} />
      <path d="M15.4 9.4 L20.6 14.6" {...common} />
      <path d="M20.6 9.4 L15.4 14.6" {...common} />
    </svg>
  );
}

export function CaptionsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox={VB} aria-hidden="true">
      <path d="M3.6 7 Q3.4 5.4 5 5.3 L19 5.3 Q20.6 5.4 20.5 7 L20.5 17 Q20.6 18.6 19 18.6 L5 18.6 Q3.4 18.6 3.6 17 Z" {...common} />
      <path d="M6.6 11 H10.2" {...common} />
      <path d="M12.7 11 H15.7" {...common} />
      <path d="M6.6 14.4 H8.7" {...common} />
      <path d="M11 14.4 H14.2" {...common} />
    </svg>
  );
}

export function FullscreenIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox={VB} aria-hidden="true">
      <path d="M4.2 9 L4.1 5 L8.2 5.1" {...common} />
      <path d="M19.8 9 L19.9 5 L15.8 5.1" {...common} />
      <path d="M4.2 15 L4.1 19 L8.2 18.9" {...common} />
      <path d="M19.8 15 L19.9 19 L15.8 18.9" {...common} />
    </svg>
  );
}
