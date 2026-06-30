import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

export function getBaseUrl() {
  const DEFAULT_BASE_URL = 'https://polutek.pl';
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}
