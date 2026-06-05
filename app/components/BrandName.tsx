import React from 'react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

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
      {APP_NAME.replace('.PL', '')}<span className="text-primary">{APP_NAME.includes('.PL') ? '.PL' : ''}</span>
    </span>
  );
};

export default BrandName;
