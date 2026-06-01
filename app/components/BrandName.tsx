import React from 'react';
import { cn } from '@/lib/utils';

interface BrandNameProps {
  className?: string;
  dotPlClassName?: string;
  variant?: 'handwriting' | 'classic';
}

const BrandName: React.FC<BrandNameProps> = ({ className, dotPlClassName, variant = 'classic' }) => {
  const isClassic = variant === 'classic';
  return (
    <span className={cn(
      isClassic ? "font-brand font-black tracking-tighter uppercase" : "font-handwriting font-bold uppercase",
      className
    )}>
      Paweł<span className={cn("text-primary", dotPlClassName)}> Perfect</span>
    </span>
  );
};

export default BrandName;
