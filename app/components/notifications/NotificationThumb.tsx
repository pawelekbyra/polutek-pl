"use client";

import Image from "next/image";
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import styles from "./notification-thumb.module.css";

type Props = {
  src: string;
  /** Same destination as the row link: the cover is a pointer-only duplicate (the row text is the accessible link). */
  link: { href: string | null; external: boolean };
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * 56 x 32 cover for video notifications. Decorative (`alt=""`, the title already names the video), lazy,
 * fixed box so nothing shifts while it loads; a failed load keeps the quiet empty box instead of a broken icon.
 */
export function NotificationThumb({ src, link, onClick }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  // A cached image can finish before hydration, so onLoad would never fire: check the element when it mounts.
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setState(node.naturalWidth > 0 ? "loaded" : "failed");
  }, []);
  const image: ReactNode = state === "failed" ? null : (
    <Image
      ref={ref}
      src={src}
      alt=""
      width={56}
      height={32}
      sizes="56px"
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`${styles.image} ${state === "loaded" ? styles.loaded : ""}`}
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
    />
  );
  const className = `${styles.thumb} ${state === "loading" ? styles.loading : state === "failed" ? styles.failed : ""}`;
  if (!link.href) return <span className={className} aria-hidden="true" data-notification-thumb>{image}</span>;
  return (
    <a className={className} href={link.href} aria-hidden="true" tabIndex={-1} data-notification-thumb
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} onClick={onClick}>
      {image}
    </a>
  );
}
