"use client";

import React from 'react';
import { useLanguage } from '../LanguageContext';

interface ReferralInfoProps {
  userId?: string | null;
  onOpenReferral: () => void;
  openSignIn: () => void;
}

const ReferralInfo: React.FC<ReferralInfoProps> = ({ userId, onOpenReferral, openSignIn }) => {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => userId ? onOpenReferral() : openSignIn()}
      className="absolute -bottom-5 right-6 text-[#1a1a1a]/20 hover:text-black hover:bg-[#1a1a1a]/5 px-2 py-1 rounded font-brand font-black text-[9px] uppercase tracking-[0.25em] transition-all z-30"
    >
      {t.noMoney}
    </button>
  );
};

export default ReferralInfo;
