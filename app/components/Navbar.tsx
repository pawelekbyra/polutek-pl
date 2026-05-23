'use client';

import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Globe, LogIn, Trophy, Star, X } from "./icons";
import { useLanguage } from './LanguageContext';
import { cn } from '@/lib/utils';
import BrandName from './BrandName';

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || "");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/?q=${encodeURIComponent(searchValue.trim())}`);
      setIsMobileSearchOpen(false);
    } else {
      router.push('/');
      setIsMobileSearchOpen(false);
    }
  };

  const isAdmin = user?.primaryEmailAddress?.emailAddress === 'pawel.perfect@gmail.com';
  return (
    <div className="flex items-center bg-blue-50/70 backdrop-blur-xl sticky top-0 z-50 border-b border-blue-100 px-4 lg:px-8 h-16 min-h-16 font-sans justify-between gap-2 md:gap-4 w-full max-w-full overflow-hidden">
      {isMobileSearchOpen ? (
        <div className="flex-1 flex items-center gap-2 px-2 animate-in slide-in-from-top-4 duration-200">
           <button
             onClick={() => setIsMobileSearchOpen(false)}
             className="p-2 hover:bg-blue-100 rounded-full transition-colors shrink-0 text-blue-900"
           >
              <X size={20} />
           </button>
           <form onSubmit={handleSearch} className="flex-1 flex">
              <input
                type="text"
                autoFocus
                placeholder="Szukaj"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full h-10 bg-white border border-blue-100 rounded-full px-5 text-sm text-blue-950 placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
           </form>
        </div>
      ) : (
        <>
          <div className="flex items-center shrink-0">
            <Link href="/" className="shrink-0 px-1 md:px-2 flex items-center gap-0 hover:opacity-80 transition-all active:scale-95">
              <BrandName className="text-[1.2rem] md:text-[1.4rem] text-blue-950" variant="handwriting" />
            </Link>
          </div>

          <div className="flex-1 max-w-[600px] hidden md:flex mx-8 min-w-0">
            <form onSubmit={handleSearch} className="flex w-full group">
              <div className="relative flex-1 flex items-center min-w-0">
                <input
                  type="text"
                  placeholder="Szukaj"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-10 bg-white/80 border border-blue-100 rounded-l-full pl-6 pr-4 text-sm text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-transparent transition-all placeholder:text-blue-300 group-hover:bg-white"
                />
              </div>
              <button type="submit" className="h-10 bg-blue-50 border border-blue-100 border-l-0 rounded-r-full px-6 hover:bg-blue-100 transition-colors shrink-0 flex items-center justify-center text-blue-600" title="Szukaj">
                <Search size={18} />
              </button>
            </form>
          </div>

          <div className="flex items-center justify-end gap-2 md:gap-4">
            <div className="flex items-center gap-1 sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2 hover:bg-blue-50 rounded-full transition-colors"
                >
                    <Search size={22} className="text-blue-600" />
                </button>
            </div>

            <div className="flex gap-1 items-center bg-white/50 rounded-full px-1.5 py-1.5 h-10 border border-blue-100">
                <button
                  onClick={() => { if (setLanguage) setLanguage('pl'); }}
                  className={cn(
                    "text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full transition-all",
                    language === 'pl' ? "bg-white text-blue-900 shadow-md" : "text-blue-400 hover:text-blue-600"
                  )}
                >
                  PL
                </button>
                <button
                  onClick={() => { if (setLanguage) setLanguage('en'); }}
                  className={cn(
                    "text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full transition-all",
                    language === 'en' ? "bg-white text-blue-900 shadow-md" : "text-blue-400 hover:text-blue-600"
                  )}
                >
                  EN
                </button>
            </div>

            {isAdmin && (
              <Link href="/admin" className="text-xs font-black uppercase tracking-tighter text-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap px-2">
                ADMIN
              </Link>
            )}

            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-blue-600 text-white hover:bg-blue-700 font-black text-[10px] sm:text-xs uppercase tracking-tight flex items-center gap-1 sm:gap-2 px-4 sm:px-6 h-10 rounded-full transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                  <LogIn size={14} className="sm:w-4 sm:h-4 text-white" />
                  <span className="hidden sm:inline">{t.signIn}</span>
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;
