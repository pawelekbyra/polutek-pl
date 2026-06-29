"use client";

import React, { useEffect, useRef } from 'react';
import { annotate } from 'rough-notation';

export interface AnnotatedTextProps {
  children: React.ReactNode;
  type?: 'underline' | 'box' | 'circle' | 'highlight' | 'strike-through' | 'crossed-off' | 'bracket';
  color?: string;
  animate?: boolean;
  multiline?: boolean;
  brackets?: ('left' | 'right' | 'top' | 'bottom')[];
}

export const AnnotatedText: React.FC<AnnotatedTextProps> = ({
  children,
  type = 'underline',
  color = 'currentColor',
  animate = true,
  multiline = false,
  brackets
}) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      const annotation = annotate(ref.current, {
        type,
        color,
        animate,
        multiline,
        brackets: brackets as any
      });
      annotation.show();
      return () => annotation.remove();
    }
  }, [type, color, animate, multiline, brackets]);

  return <span ref={ref}>{children}</span>;
};
