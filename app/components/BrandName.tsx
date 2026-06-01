import React from 'react';
import { cn } from '@/lib/utils';

interface BrandNameProps {
  className?: string;
  variant?: 'handwriting' | 'classic';
}

const BrandName: React.FC<BrandNameProps> = ({ className, variant = 'classic' }) => {
  const isClassic = variant === 'classic';
  return (
    <span className={cn(
      isClassic ? "font-brand font-black tracking-tighter uppercase" : "font-handwriting font-bold uppercase",
      className
    )}>
      POLUTEK<span className="text-primary">.PL</span>
    </span>
  );
};

export default BrandName;
