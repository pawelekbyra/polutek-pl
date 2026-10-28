import { MarkerIcon } from "./MarkerBellIcons";
import type { SVGProps } from "react";

/**
 * Notification type icons, set B (Marker): 24 grid, round caps and joins, no fills, same pen as the bell, "Szeruj" and "Lajk"
 * (1.2px on screen at any size, see MarkerBellIcons). Plain JSX paths, inheriting currentColor.
 */
type P = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> & { size?: number | string };

export function SparkIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M11 3.5C11.4 7.6 13.4 9.6 17.5 10C13.4 10.4 11.4 12.4 11 16.5C10.6 12.4 8.6 10.4 4.5 10C8.6 9.6 10.6 7.6 11 3.5Z" />
      <path d="M18.5 15.5V20.5M16 18H21" />
    </MarkerIcon>
  );
}
export function GiftIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M4 11.5H20V20H4Z" />
      <path d="M3 7.5H21V11.5H3Z" />
      <path d="M12 7.5V20" />
      <path d="M12 7.5C12 7.5 11 4 8.7 4C6.5 4 6.6 7.5 8.8 7.5H12ZM12 7.5C12 7.5 13 4 15.3 4C17.5 4 17.4 7.5 15.2 7.5H12Z" />
    </MarkerIcon>
  );
}
export function ReplyIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M4.5 12.2C4.5 7.9 7.9 4.8 12.2 4.8C16.4 4.8 19.7 7.9 19.7 12C19.7 16.2 16.4 19.3 12.2 19.3C11 19.3 9.9 19.1 8.9 18.7L4.6 19.8L5.8 16.2C5 15.1 4.5 13.7 4.5 12.2Z" />
      <path d="M9 11.2H15.4M9 14H13" />
    </MarkerIcon>
  );
}
export function HeartIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M12 19.7C12 19.7 4 14.9 4 9.3C4 6.7 6 5 8.2 5C9.8 5 11.2 5.8 12 7.2C12.8 5.8 14.2 5 15.8 5C18 5 20 6.7 20 9.3C20 14.9 12 19.7 12 19.7Z" />
    </MarkerIcon>
  );
}
export function ThumbIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M8 10.5V19.5H5V10.5Z" />
      <path d="M8 10.5L11.2 4.3C12.8 4.3 13.8 5.5 13.5 7.1L13 9.5H18.2C19.4 9.5 20.2 10.5 20 11.6L19 18C18.8 18.9 18 19.5 17.1 19.5H8" />
    </MarkerIcon>
  );
}
export function PlayBoxIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M4 7.2C4 6 5 5 6.2 5H17.8C19 5 20 6 20 7.2V16.8C20 18 19 19 17.8 19H6.2C5 19 4 18 4 16.8Z" />
      <path d="M10.2 9.2L15 12L10.2 14.8Z" />
    </MarkerIcon>
  );
}
export function ClockIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M12 3.8C16.5 3.8 20.2 7.5 20.2 12C20.2 16.5 16.5 20.2 12 20.2C7.5 20.2 3.8 16.5 3.8 12C3.8 7.5 7.5 3.8 12 3.8Z" />
      <path d="M12 7.5V12L15 13.8" />
    </MarkerIcon>
  );
}
export function ShieldIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M12 3.5L19 6V11.5C19 15.6 16 18.8 12 20.5C8 18.8 5 15.6 5 11.5V6Z" />
      <path d="M12 8.5V12.2M12 15.2V15.3" />
    </MarkerIcon>
  );
}
export function MegaphoneIcon(p: P) {
  return (
    <MarkerIcon {...p}>
      <path d="M4 10.2H7.5L15.5 5.5V18.5L7.5 13.8H4Z" />
      <path d="M7.8 14L9 19H11.2L10.3 15.2" />
      <path d="M18.5 9.5C19.3 10.3 19.3 13.7 18.5 14.5" />
    </MarkerIcon>
  );
}
