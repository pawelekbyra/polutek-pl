'use client';

import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="py-12 px-8 bg-black border-t border-zinc-900 flex flex-col justify-center items-center gap-4">
      <span className="font-brand font-black text-[14px] uppercase tracking-[0.4em] text-zinc-600 opacity-50 hover:opacity-100 transition-opacity cursor-default">
        WWW.POLUTEK.PL
      </span>
    </footer>
  );
};

export default Footer;
