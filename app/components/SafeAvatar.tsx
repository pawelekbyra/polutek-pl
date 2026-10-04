"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";

interface SafeAvatarProps {
  src?: string | null;
  alt: string;
  size: number;
  fallbackSrc?: string;
  className?: string;
}

export function SafeAvatar({
  src,
  alt,
  size,
  fallbackSrc,
  className
}: SafeAvatarProps) {
  const [error, setError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  // Our own default avatar (no third-party avatar service: it would receive the seed and is not in the CSP).
  const finalFallback = fallbackSrc || DEFAULT_AVATAR_URL;

  const showFallback = error || !src;

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-neutral-100 flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={showFallback ? finalFallback : src!}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setError(true)}
        // Our own avatar route has a version query string and is already a tiny image.
        unoptimized={!showFallback && String(src).startsWith("/api/avatars/")}
      />
    </div>
  );
}
