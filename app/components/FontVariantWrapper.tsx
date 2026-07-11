"use client";

import React from "react";

interface FontVariantWrapperProps {
  variant: number;
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function FontVariantWrapper({
  variant,
  children,
  title,
  description,
}: FontVariantWrapperProps) {
  return (
    <div data-font-variant={variant}>
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white py-2 px-4 text-center text-sm font-bold">
        TEST CZCIONEK #{variant}: {title} — {description}
        <br />
        <span className="text-xs opacity-90">Porównaj z innymi wersjami: /czcionka1 do /czcionka6</span>
      </div>
      <div className="pt-16">{children}</div>
    </div>
  );
}
