"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SafeAvatarProps {
  src?: string | null;
  alt: string;
  size: number;
  fallbackSeed?: string | null;
  fallbackSrc?: string;
  className?: string;
}

export function SafeAvatar({
  src,
  alt,
  size,
  fallbackSeed,
  fallbackSrc,
  className
}: SafeAvatarProps) {
  const [error, setError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  const defaultFallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fallbackSeed || alt || "default")}`;
  const finalFallback = fallbackSrc || defaultFallback;

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
        unoptimized={showFallback && finalFallback.includes("dicebear.com")}
      />
    </div>
  );
}
