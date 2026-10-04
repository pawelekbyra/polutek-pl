import React from "react";
import { flagSrc, type LanguageOption } from "./languages";

/**
 * Round flag next to a language name. Decorative (empty alt): the name is always in the text.
 * A plain <img> with fixed width/height: a tiny static SVG gains nothing from next/image, and the
 * fixed box means no layout shift while it loads.
 */
export default function LanguageFlag({ option, size }: { option: LanguageOption; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSrc(option)}
      alt=""
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      style={{ width: size, height: size }}
      className="shrink-0 select-none rounded-full shadow-[0_0_0_1px_var(--cm-line-84)]"
    />
  );
}
