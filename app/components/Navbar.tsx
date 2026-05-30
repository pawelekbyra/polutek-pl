'use client';

import React, { useState } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, LogIn, X } from "./icons";
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

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'pawel.perfect@gmail.com';
  const isAdmin = user?.primaryEmailAddress?.emailAddress === adminEmail;

  return (
    <div className="sticky top-0 z-50 flex h-16 min-h-16 w-full max-w-full items-center justify-between gap-2 overflow-hidden border-b border-white/70 bg-white/80 px-4 font-sans shadow-sm shadow-neutral-900/5 backdrop-blur-xl md:gap-4 lg:px-8">
      {isMobileSearchOpen ? (
        <div className="flex-1 flex items-center gap-2 px-2 animate-in slide-in-from-top-4 duration-200">
           <button
             onClick={() => setIsMobileSearchOpen(false)}
             className="p-2 hover:bg-neutral-200 rounded-full transition-colors shrink-0"
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
               className="w-full h-9 bg-white border border-neutral-300 rounded-full px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
             />
           </form>
        </div>
      ) : (
        <>
          <div className="flex items-center shrink-0">
            <Link href="/" className="shrink-0 px-1 md:px-2 flex items-center gap-0 hover:opacity-80 transition-all active:scale-95">
              <BrandName className="text-[1.1rem] md:text-[1.3rem]" variant="handwriting" />
            </Link>
          </div>

          <div className="flex-1 max-w-[540px] hidden md:flex mx-4 min-w-0">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="relative flex-1 flex items-center min-w-0">
                <input
                  type="text"
                  placeholder="Szukaj"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="h-10 w-full rounded-l-full border border-neutral-200 bg-white/90 pl-6 pr-4 text-sm shadow-inner transition-all placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                />
              </div>
              <button type="submit" className="flex h-10 shrink-0 items-center justify-center rounded-r-full border border-l-0 border-neutral-200 bg-neutral-950 px-5 text-white transition-all hover:bg-blue-700" title="Szukaj">
                <Search size={18} />
              </button>
            </form>
          </div>

          <div className="flex items-center justify-end gap-1 md:gap-3">
            <div className="flex items-center gap-1 sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2 hover:bg-neutral-200 rounded-full transition-colors"
                >
                    <Search size={20} className="text-neutral-600" />
                </button>
            </div>

            <div className="flex h-10 items-center gap-1 rounded-full border border-neutral-200 bg-white/70 px-1 py-1 shadow-sm sm:px-2">
                <button
                  onClick={() => { if (setLanguage) setLanguage('pl'); }}
                  className={cn(
                    "text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full transition-all",
                    language === 'pl' ? "bg-white shadow-sm text-neutral-900 border border-neutral-300" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  PL
                </button>
                <button
                  onClick={() => { if (setLanguage) setLanguage('en'); }}
                  className={cn(
                    "text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full transition-all",
                    language === 'en' ? "bg-white shadow-sm text-neutral-900 border border-neutral-300" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  EN
                </button>
            </div>

            {/* Pionowy separator */}
            <div className="h-6 w-px bg-neutral-300 mx-1" aria-hidden="true" />

            {isAdmin && (
              <Link href="/admin" className="text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors whitespace-nowrap px-2">
                Admin
              </Link>
            )}

            <SignedOut>
              <SignInButton mode="modal">
                <button className="flex h-10 items-center gap-1 rounded-full border border-neutral-900 bg-neutral-950 px-2.5 text-[10px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95 sm:gap-2 sm:px-4 sm:text-xs">
                  <LogIn size={14} className="text-white sm:h-4 sm:w-4" />
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
