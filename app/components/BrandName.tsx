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
      isClassic ? "font-brand font-black tracking-tighter uppercase text-neutral-950" : "font-handwriting font-bold uppercase text-neutral-950",
      className
    )}>
      {baseName}<span className="text-primary">{dotSuffixMatch?.[0] ?? ''}</span>
    </span>
  );
};

export default BrandName;
