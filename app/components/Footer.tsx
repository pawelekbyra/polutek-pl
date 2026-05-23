'use client';

import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="py-12 px-8 bg-blue-50/50 border-t border-blue-100 flex flex-col justify-center items-center gap-4">
      <span className="font-brand font-black text-[14px] uppercase tracking-[0.4em] text-blue-900/40 hover:text-blue-900 transition-all cursor-default">
        WWW.POLUTEK.PL
      </span>
    </footer>
  );
};

export default Footer;
