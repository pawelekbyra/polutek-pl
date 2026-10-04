"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";

interface SafeAvatarProps {
  src?: string | null;
  alt: string;
  size: number;
  /** Shown when `src` is missing or fails to load; defaults to our own local default avatar. */
  fallbackSrc?: string;
  className?: string;
}

export function SafeAvatar({
  src,
  alt,
  size,
  fallbackSrc = DEFAULT_AVATAR_URL,
  className
}: SafeAvatarProps) {
  const [error, setError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  const showFallback = error || !src;
  const imageSrc = showFallback ? fallbackSrc : src!;

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-neutral-100 flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setError(true)}
        // Our own avatar route has a version query string and is already a tiny image.
        unoptimized={imageSrc.startsWith("/api/avatars/")}
      />
    </div>
  );
}
