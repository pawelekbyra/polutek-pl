import React from 'react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

interface BrandNameProps {
  className?: string;
  variant?: 'handwriting' | 'classic';
  style?: React.CSSProperties;
}

const UI_COPY_AND_LAYOUT_TWEAKS = `
html[lang="pl"] #donations ul > li:nth-child(2) {
  font-size: 0;
}

html[lang="pl"] #donations ul > li:nth-child(2) > span {
  font-size: 9px;
}

html[lang="pl"] #donations ul > li:nth-child(2)::after {
  content: "Do Strefy Fenkju dostęp wieczny";
  color: var(--chan-ink);
  font-size: 12.5px;
  line-height: 1.4;
}

html[lang="pl"] div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] ul > li:first-child {
  font-size: 0;
}

html[lang="pl"] div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] ul > li:first-child > span {
  font-size: 9px;
}

html[lang="pl"] div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] ul > li:first-child::after {
  content: "Wieczny dostęp do Strefy Fenkju";
  color: var(--chan-ink);
  font-size: 13px;
  line-height: 1.4;
}

a > span[class*="tracking-[0.04em]"] + span[class*="bg-[#EFF3FE]"] {
  margin-left: -0.25rem !important;
}

@media (min-width: 768px) {
  div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] {
    justify-content: flex-start !important;
    padding: 1.5rem 1.75rem !important;
  }

  div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] > div:first-child {
    align-self: flex-start !important;
    margin-bottom: 1.75rem !important;
    transform: translate(-0.25rem, -0.15rem);
  }

  div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] > div:nth-child(2) {
    gap: 1.25rem !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    transform: translateY(-0.35rem);
  }

  div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] svg[viewBox="0 0 200 150"] {
    width: min(210px, 62%) !important;
  }

  div[class*="md:w-[45%]"][class*="bg-[var(--chan-surface)]"] > div:last-child {
    margin-top: auto !important;
    padding-top: 1.25rem !important;
  }
}

div[id^="comment-"] .absolute.right-0.mt-1.w-48.bg-white > button:first-child {
  display: none !important;
}
`;

const BrandName: React.FC<BrandNameProps> = ({ className, variant = 'classic', style }) => {
  const isClassic = variant === 'classic';
  const dotSuffixMatch = APP_NAME.match(/\.pl$/i);
  const baseName = dotSuffixMatch ? APP_NAME.slice(0, -dotSuffixMatch[0].length) : APP_NAME;
  const suffix = (dotSuffixMatch?.[0] ?? '').toUpperCase();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UI_COPY_AND_LAYOUT_TWEAKS }} />
      <span className={cn(
        isClassic
          ? "font-brand font-black tracking-[0.12em] uppercase text-[#171717] drop-shadow-[0_1px_8px_rgba(255,255,255,0.12)]"
          : "font-handwriting font-bold uppercase text-neutral-950",
        className
      )} style={style}>
        {baseName.toUpperCase()}<span className={isClassic ? "text-[#60A5FA] drop-shadow-[0_0_10px_rgba(37,99,235,0.45)]" : "text-primary"}>{suffix}</span>
      </span>
    </>
  );
};

export default BrandName;
