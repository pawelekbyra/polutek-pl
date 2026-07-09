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
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.1));
}

.polutek-brand-premium::before {
  content: "";
  position: absolute;
  z-index: -2;
  inset: -0.38em -0.58em -0.34em;
  border-radius: 999px;
  background:
    radial-gradient(ellipse at 50% 52%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.24) 22%, rgba(191, 219, 254, 0.1) 42%, rgba(255, 255, 255, 0) 68%);
  filter: blur(4px);
  opacity: 0.46;
  transform: scale(0.98);
  transform-origin: center;
  pointer-events: none;
  animation: polutek-premium-bloom 5.6s ease-in-out infinite;
}

.polutek-brand-premium::after {
  content: "";
  position: absolute;
  z-index: -1;
  left: 50%;
  top: 50%;
  width: 112%;
  height: 0.1em;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.03) 18%, rgba(255, 255, 255, 0.42) 50%, rgba(255, 255, 255, 0.08) 74%, transparent 100%);
  mix-blend-mode: screen;
  opacity: 0.36;
  transform: translate(-50%, -50%) rotate(-7deg) scaleX(0.88);
  pointer-events: none;
  animation: polutek-premium-sweep 6.4s ease-in-out infinite;
}

.polutek-brand-copy {
  position: relative;
  z-index: 1;
  text-shadow:
    0 0 5px rgba(255, 255, 255, 0.18),
    0 0 12px rgba(255, 255, 255, 0.1);
}

.polutek-brand-dot {
  text-shadow:
    0 0 8px rgba(255, 255, 255, 0.34),
    0 0 16px rgba(96, 165, 250, 0.34);
}

@keyframes polutek-premium-bloom {
  0%, 100% {
    opacity: 0.34;
    transform: scale(0.96);
  }

  48% {
    opacity: 0.54;
    transform: scale(1.01);
  }
}

@keyframes polutek-premium-sweep {
  0%, 100% {
    opacity: 0.18;
    transform: translate(-51%, -50%) rotate(-7deg) scaleX(0.82);
  }

  46% {
    opacity: 0.42;
    transform: translate(-49%, -50%) rotate(-7deg) scaleX(0.98);
  }
}

@media (prefers-reduced-motion: reduce) {
  .polutek-brand-premium::before,
  .polutek-brand-premium::after {
    animation: none;
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
