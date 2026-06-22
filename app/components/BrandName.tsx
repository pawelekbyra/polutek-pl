import React from 'react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

interface BrandNameProps {
  className?: string;
  variant?: 'handwriting' | 'classic' | 'legacyLogo';
}

const BrandName: React.FC<BrandNameProps> = ({ className, variant = 'classic' }) => {
  const dotSuffixMatch = APP_NAME.match(/\.pl$/i);
  const baseName = dotSuffixMatch ? APP_NAME.slice(0, -dotSuffixMatch[0].length) : APP_NAME;

  const variantClasses = {
    classic: "font-brand font-black tracking-tighter uppercase text-neutral-950",
    handwriting: "font-handwriting font-bold uppercase text-neutral-950",
    legacyLogo: "font-[family:var(--font-pirata)] font-normal uppercase tracking-tight text-neutral-950"
  };

  return (
    <span className={cn(
      variantClasses[variant],
      className
    )}>
      {baseName}<span className="text-primary">{dotSuffixMatch?.[0] ?? ''}</span>
    </span>
  );
};

export default BrandName;
