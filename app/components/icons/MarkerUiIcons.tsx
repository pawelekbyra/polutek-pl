import type { SVGProps } from "react";

/**
 * Hand-drawn "Marker" icons (set B: 24 grid, 2.4 line, round caps and joins, no fills, light hand wobble) for the buffering
 * spinner, the player's error screen, the top bar's search (lens, close) and anything else that needs the same hand.
 * Same drawing method and wrapper as the player set (`player/controls/PlayerIconSet.tsx`) and the bell: plain JSX paths
 * inheriting `currentColor`, no icon library, no raw HTML injection. The player-style icons draw a 2.4 line (2px at 20px);
 * the top bar's lens and close (`SearchIcon`, `CloseIcon`) use the thin pen of the Szeruj/Lajk icons instead: `strokeWidth`
 * defaults to `ICON_PEN_PX * 24 / size`, i.e. 1.2px on screen at any size.
 *
 * Generated from icongen/gen_ui.py (path data is not edited by hand). The spinner arc has no offset so that it
 * turns around the centre of the box.
 */
type MarkerIconProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> & { size?: number | string };

function MarkerIcon({ size = 24, strokeWidth = 2.4, ...rest }: MarkerIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

/** Rendered pen width in CSS px for the top bar's lens and close: equal to Szeruj/Lajk (16px icon, strokeWidth 1.8). */
export const ICON_PEN_PX = 1.2;

function penStrokeWidth(size: number | string): number {
  const px = typeof size === "number" ? size : Number.parseFloat(size);
  return Number.isFinite(px) && px > 0 ? Math.round(((ICON_PEN_PX * 24) / px) * 1000) / 1000 : 1.8;
}

export function SpinnerArcIcon(props: MarkerIconProps) {
  return (
    <MarkerIcon {...props}>
      <path d="M15.23 3.22C15.48 3.36 16.26 3.71 16.74 4.01C17.22 4.32 17.68 4.66 18.1 5.04C18.51 5.42 18.9 5.85 19.24 6.3C19.57 6.76 19.86 7.26 20.11 7.77C20.36 8.28 20.56 8.81 20.72 9.36C20.87 9.9 20.98 10.47 21.04 11.03C21.09 11.59 21.1 12.17 21.04 12.73C20.99 13.29 20.87 13.86 20.7 14.39C20.52 14.93 20.28 15.46 20.01 15.95C19.73 16.44 19.39 16.91 19.03 17.34C18.66 17.78 18.26 18.19 17.82 18.54C17.38 18.9 16.91 19.23 16.41 19.49C15.91 19.76 15.37 19.98 14.83 20.14C14.29 20.3 13.72 20.4 13.16 20.46C12.6 20.51 12.02 20.52 11.46 20.48C10.9 20.44 10.33 20.35 9.78 20.21C9.23 20.07 8.69 19.87 8.19 19.61C7.69 19.36 7.2 19.03 6.78 18.67C6.35 18.3 5.96 17.87 5.63 17.41C5.29 16.96 5.01 16.46 4.77 15.94C4.53 15.43 4.34 14.89 4.2 14.34C4.06 13.79 3.97 13.22 3.94 12.66C3.92 12.09 3.94 11.51 4.04 10.96C4.13 10.4 4.42 9.59 4.5 9.32" />
    </MarkerIcon>
  );
}

export function AlertIcon(props: MarkerIconProps) {
  return (
    <MarkerIcon {...props}>
      <path d="M10.91 5.73C11.28 5.33 11.79 4.75 12.22 4.77C12.64 4.79 13.1 5.43 13.46 5.85C13.82 6.26 14.07 6.8 14.37 7.28C14.66 7.77 14.94 8.26 15.21 8.76C15.48 9.26 15.74 9.76 15.99 10.27C16.25 10.77 16.5 11.28 16.76 11.79C17.02 12.29 17.27 12.79 17.55 13.29C17.82 13.79 18.1 14.28 18.38 14.77C18.67 15.26 18.97 15.74 19.27 16.22C19.57 16.7 19.98 17.16 20.18 17.66C20.38 18.16 20.69 18.89 20.48 19.22C20.26 19.55 19.43 19.57 18.88 19.63C18.34 19.7 17.75 19.62 17.18 19.62C16.62 19.61 16.05 19.6 15.49 19.6C14.92 19.59 14.35 19.58 13.79 19.57C13.22 19.56 12.65 19.55 12.09 19.54C11.52 19.53 10.95 19.53 10.39 19.52C9.82 19.52 9.25 19.53 8.69 19.53C8.12 19.54 7.55 19.56 6.99 19.58C6.42 19.6 5.82 19.72 5.29 19.64C4.75 19.57 3.96 19.48 3.78 19.13C3.59 18.78 3.99 18.06 4.2 17.55C4.41 17.04 4.76 16.56 5.04 16.07C5.31 15.57 5.58 15.08 5.85 14.58C6.12 14.08 6.38 13.57 6.65 13.07C6.91 12.57 7.17 12.07 7.44 11.57C7.7 11.07 7.97 10.57 8.24 10.07C8.52 9.58 8.8 9.08 9.09 8.6C9.38 8.11 9.68 7.63 9.99 7.15C10.29 6.68 10.54 6.12 10.91 5.73Z" />
      <path d="M11.86 9.65C11.86 9.82 11.86 9.99 11.86 10.67C11.86 11.36 11.86 13.24 11.86 13.75" />
      <path d="M12.13 16.5C12.13 16.51 12.13 16.53 12.13 16.58C12.13 16.63 12.13 16.76 12.13 16.8" />
    </MarkerIcon>
  );
}

export function RefreshIcon(props: MarkerIconProps) {
  return (
    <MarkerIcon {...props}>
      <path d="M19.25 7.93C19.36 8.19 19.78 8.95 19.95 9.5C20.11 10.04 20.21 10.62 20.25 11.19C20.29 11.76 20.27 12.34 20.2 12.91C20.13 13.48 20.02 14.05 19.85 14.6C19.69 15.14 19.48 15.69 19.21 16.19C18.94 16.69 18.61 17.18 18.23 17.6C17.85 18.02 17.39 18.39 16.91 18.7C16.44 19.01 15.91 19.26 15.38 19.48C14.85 19.69 14.29 19.86 13.73 19.98C13.17 20.1 12.59 20.18 12.02 20.2C11.45 20.22 10.87 20.19 10.31 20.08C9.75 19.97 9.19 19.78 8.68 19.53C8.17 19.28 7.69 18.94 7.25 18.58C6.8 18.22 6.39 17.81 6.02 17.38C5.65 16.94 5.3 16.48 5 15.99C4.7 15.5 4.44 14.98 4.24 14.44C4.05 13.91 3.9 13.34 3.84 12.77C3.78 12.21 3.8 11.62 3.88 11.06C3.97 10.5 4.15 9.94 4.37 9.41C4.58 8.88 4.87 8.37 5.18 7.89C5.49 7.41 5.84 6.95 6.21 6.52C6.59 6.08 7.24 5.51 7.44 5.31" />
      <path d="M4.43 4.33C4.69 4.36 5.51 4.4 6.03 4.52C6.55 4.64 7.27 4.71 7.54 5.05C7.81 5.39 7.73 6.06 7.65 6.56C7.56 7.06 7.14 7.8 7.04 8.05" />
    </MarkerIcon>
  );
}

export function SearchIcon(props: MarkerIconProps) {
  return (
    <MarkerIcon {...props} strokeWidth={props.strokeWidth ?? penStrokeWidth(props.size ?? 24)}>
      <path d="M17.76 10.66C17.77 11.21 17.71 11.78 17.6 12.32C17.48 12.86 17.32 13.41 17.09 13.92C16.86 14.42 16.58 14.92 16.23 15.35C15.89 15.78 15.48 16.18 15.04 16.52C14.6 16.85 14.1 17.13 13.59 17.34C13.08 17.56 12.53 17.72 11.98 17.82C11.44 17.92 10.87 17.97 10.32 17.95C9.76 17.93 9.2 17.86 8.66 17.72C8.13 17.57 7.6 17.35 7.13 17.07C6.65 16.78 6.21 16.41 5.83 16.02C5.44 15.62 5.11 15.16 4.81 14.69C4.52 14.22 4.28 13.7 4.08 13.18C3.88 12.67 3.71 12.12 3.62 11.58C3.52 11.03 3.47 10.46 3.51 9.91C3.54 9.36 3.66 8.79 3.84 8.27C4.03 7.76 4.31 7.25 4.62 6.79C4.93 6.34 5.31 5.91 5.71 5.53C6.11 5.15 6.56 4.79 7.03 4.49C7.5 4.2 8 3.94 8.53 3.75C9.05 3.57 9.61 3.43 10.16 3.39C10.7 3.34 11.28 3.38 11.82 3.48C12.36 3.59 12.91 3.78 13.41 4.01C13.91 4.25 14.39 4.56 14.83 4.89C15.27 5.23 15.68 5.62 16.04 6.05C16.4 6.47 16.72 6.94 16.97 7.43C17.23 7.92 17.43 8.46 17.56 9C17.69 9.53 17.76 10.1 17.76 10.66Z" />
      <path d="M16.19 16.05C16.39 16.25 16.98 16.83 17.37 17.23C17.76 17.62 18.15 18.01 18.54 18.4C18.94 18.79 19.33 19.18 19.72 19.58C20.11 19.97 20.7 20.55 20.89 20.75" />
    </MarkerIcon>
  );
}

export function CloseIcon(props: MarkerIconProps) {
  return (
    <MarkerIcon {...props} strokeWidth={props.strokeWidth ?? penStrokeWidth(props.size ?? 24)}>
      <path d="M5.82 5.78C6.03 5.99 6.65 6.61 7.06 7.02C7.47 7.43 7.89 7.85 8.3 8.26C8.71 8.67 9.13 9.09 9.54 9.5C9.95 9.91 10.37 10.33 10.78 10.74C11.19 11.15 11.61 11.57 12.02 11.98C12.43 12.39 12.85 12.81 13.26 13.22C13.67 13.63 14.09 14.05 14.5 14.46C14.91 14.87 15.33 15.29 15.74 15.7C16.15 16.11 16.57 16.53 16.98 16.94C17.39 17.35 18.01 17.97 18.22 18.18" />
      <path d="M18.27 5.72C18.07 5.92 17.45 6.54 17.03 6.96C16.62 7.37 16.21 7.78 15.79 8.2C15.38 8.61 14.97 9.02 14.55 9.44C14.14 9.85 13.73 10.26 13.31 10.68C12.9 11.09 12.49 11.5 12.07 11.92C11.66 12.33 11.25 12.74 10.83 13.16C10.42 13.57 10.01 13.98 9.59 14.4C9.18 14.81 8.77 15.22 8.35 15.64C7.94 16.05 7.53 16.46 7.11 16.88C6.7 17.29 6.08 17.91 5.87 18.12" />
    </MarkerIcon>
  );
}
