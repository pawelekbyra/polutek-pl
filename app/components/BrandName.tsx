import React from 'react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

interface BrandNameProps {
  className?: string;
  variant?: 'handwriting' | 'classic';
}

const BrandName: React.FC<BrandNameProps> = ({ className, variant = 'classic' }) => {
  const isClassic = variant === 'classic';
  const dotSuffixMatch = APP_NAME.match(/\.pl$/i);
  const baseName = dotSuffixMatch ? APP_NAME.slice(0, -dotSuffixMatch[0].length) : APP_NAME;

  return (
    <span className={cn(
      isClassic ? "font-brand tracking-[0.04em] uppercase text-[#171717]" : "font-handwriting font-bold uppercase text-neutral-950",
      className
    )}>
      {baseName.toUpperCase()}<span className="text-primary">{(dotSuffixMatch?.[0] ?? '').toUpperCase()}</span>
    </span>
  );
};

export default BrandName;
