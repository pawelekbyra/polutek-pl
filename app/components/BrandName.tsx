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

.polutek-brand-premium {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: baseline;
  overflow: visible;
  filter:
    drop-shadow(0 0 1px rgba(255, 255, 255, 0.34))
    drop-shadow(0 0 7px rgba(96, 165, 250, 0.12));
}

.polutek-brand-premium::before,
.polutek-brand-premium::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.polutek-brand-premium::before {
  z-index: -2;
  inset: -0.44em -0.66em -0.38em;
  border-radius: 999px;
  background:
    radial-gradient(ellipse 58% 72% at 50% 54%, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.16) 21%, rgba(147, 197, 253, 0.08) 43%, transparent 68%),
    radial-gradient(ellipse 86% 52% at 50% 52%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 36%, transparent 72%);
  filter: blur(2.5px);
  opacity: 0.62;
  transform: scale3d(0.98, 0.96, 1);
  transform-origin: center;
  animation: polutek-premium-breathe 7.2s ease-in-out infinite;
}

.polutek-brand-premium::after {
  z-index: -1;
  left: 0;
  top: 50%;
  width: 32%;
  height: 175%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 28%, rgba(255, 255, 255, 0.44) 48%, rgba(191, 219, 254, 0.18) 58%, transparent 100%);
  opacity: 0;
  filter: blur(0.35px);
  mix-blend-mode: screen;
  transform: translate3d(-145%, -50%, 0) skewX(-18deg) rotate(8deg);
  transform-origin: center;
  animation: polutek-premium-glint 6.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.polutek-brand-copy {
  position: relative;
  z-index: 1;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 7px rgba(255, 255, 255, 0.13);
}

.polutek-brand-dot {
  text-shadow:
    0 0 7px rgba(255, 255, 255, 0.34),
    0 0 15px rgba(96, 165, 250, 0.34),
    0 0 1px rgba(255, 255, 255, 0.72);
}

@keyframes polutek-premium-breathe {
  0%, 100% {
    opacity: 0.46;
    transform: scale3d(0.96, 0.94, 1);
  }

  45% {
    opacity: 0.7;
    transform: scale3d(1.02, 1, 1);
  }
}

@keyframes polutek-premium-glint {
  0%, 18%, 100% {
    opacity: 0;
    transform: translate3d(-145%, -50%, 0) skewX(-18deg) rotate(8deg);
  }

  34% {
    opacity: 0.5;
  }

  52% {
    opacity: 0.18;
    transform: translate3d(330%, -50%, 0) skewX(-18deg) rotate(8deg);
  }

  58% {
    opacity: 0;
    transform: translate3d(365%, -50%, 0) skewX(-18deg) rotate(8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .polutek-brand-premium::before,
  .polutek-brand-premium::after {
    animation: none;
  }

  .polutek-brand-premium::after {
    opacity: 0.12;
    transform: translate3d(110%, -50%, 0) skewX(-18deg) rotate(8deg);
  }
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
          ? "polutek-brand-premium font-brand font-black tracking-[0.12em] uppercase text-[#171717] drop-shadow-[0_1px_8px_rgba(255,255,255,0.12)]"
          : "font-handwriting font-bold uppercase text-neutral-950",
        className
      )} style={style}>
        <span className={isClassic ? "polutek-brand-copy" : undefined}>
          {baseName.toUpperCase()}<span className={isClassic ? "polutek-brand-dot text-[#60A5FA] drop-shadow-[0_0_10px_rgba(37,99,235,0.45)]" : "text-primary"}>{suffix}</span>
        </span>
      </span>
    </>
  );
};

export default BrandName;
