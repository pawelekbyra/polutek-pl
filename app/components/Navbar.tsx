'use client';

import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Globe, LogIn, Trophy, Star, X } from "./icons";
import BrandName from './BrandName';
import { useLanguage } from './LanguageContext';

export default function Navbar() {
  const { user, isLoaded } = useUser();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage } = useLanguage();

  // Initialize search query from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    router.push('/');
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-sm border-b border-gray-100' : 'bg-white border-b border-gray-200'
      }`}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-[72px] flex items-center justify-between gap-4 md:gap-8">
          
          <div className="flex items-center gap-4">
            <Link href="/" className="flex-shrink-0">
              <BrandName />
            </Link>
          </div>

          <div className="flex-1 max-w-2xl mx-auto hidden md:block">
            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-full leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                placeholder="Szukaj..."
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full p-1">
              <button
                onClick={() => setLanguage('pl')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  language === 'pl' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                PL
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  language === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                EN
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-4 border-l border-gray-200 pl-4">
              <SignedIn>
                <div className="flex items-center gap-3">
                  {isLoaded && user && (
                    <div className="flex items-center gap-3">
                      {user.publicMetadata?.isCreator && (
                         <Link href="/admin" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                           Panel Twórcy
                         </Link>
                      )}
                      <UserButton afterSignOutUrl="/" />
                    </div>
                  )}
                </div>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-blue-600 transition-colors">
                    <LogIn className="w-4 h-4" />
                    <span className="hidden lg:inline">Zaloguj się</span>
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>

        </div>
      </nav>
      
      {/* Mobile search - visible only on small screens when searching */}
      <div className="md:hidden fixed top-[72px] left-0 right-0 bg-white border-b border-gray-100 p-3 z-40">
         <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-full bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Szukaj..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </form>
      </div>
    </>
  );
}
