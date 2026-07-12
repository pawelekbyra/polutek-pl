import React from 'react';
import { cn } from '@/lib/utils';
import LogoFlare from './LogoFlare';

interface BrandNameProps {
  className?: string;
  variant?: 'handwriting' | 'classic';
  style?: React.CSSProperties;
}

const LOGO_FLARE_STYLES = `
.polutek-logo-flare-spin {
  transform-origin: 100px 100px;
  animation: polutek-logo-flare-spin 18s linear infinite;
}

.polutek-logo-flare-pulse {
  transform-origin: 100px 100px;
  animation: polutek-logo-flare-pulse 3.2s ease-in-out infinite;
}

@keyframes polutek-logo-flare-spin {
  to { transform: rotate(360deg); }
}

@keyframes polutek-logo-flare-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .polutek-logo-flare-spin,
  .polutek-logo-flare-pulse {
    animation: none;
  }
}
`;

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

const BrandName: React.FC<BrandNameProps> = ({ className, style }) => {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UI_COPY_AND_LAYOUT_TWEAKS + LOGO_FLARE_STYLES }} />
      <span className={cn("relative inline-flex items-center justify-center", className)} style={style}>
        <LogoFlare className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[3em] w-[3em] -translate-x-1/2 -translate-y-1/2" />
        <img
          src="/logo-glasses.svg"
          alt="POLUTEK.PL"
          className="relative h-[1.6em] w-auto"
        />
      </span>
    </>
  );
};

export default BrandName;
