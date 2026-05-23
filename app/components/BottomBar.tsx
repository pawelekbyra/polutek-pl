'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Video, Star, Users, Trophy, Dollar } from './icons';
import { cn } from '@/lib/utils';

const BottomBar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const v = searchParams.get('v');

  const navItems = [
    {
      label: 'Home',
      icon: Video,
      href: '/',
      isActive: pathname === '/' && !v
    },
    {
      label: 'VIP',
      icon: Star,
      href: '/?v=wuthering', // Example VIP content
      isActive: v === 'wuthering'
    },
    {
      label: 'Zrzutka',
      icon: HeartIcon, // Custom or fallback
      href: '/zrzutka',
      isActive: pathname === '/zrzutka'
    },
    {
      label: 'Profil',
      icon: Users,
      href: '/profile',
      isActive: pathname === '/profile'
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      <div className="bg-blue-50/80 backdrop-blur-xl border-t border-blue-100 flex items-center justify-around h-16 px-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-all active:scale-90",
              item.isActive ? "text-blue-600" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <item.icon size={24} className={cn(item.isActive && "animate-pulse")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Simple internal Heart component since it wasn't exported in original icons/index.tsx for this use
const HeartIcon = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

export default BottomBar;
