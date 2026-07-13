import React from 'react';

interface LogoFlareProps {
  className?: string;
}

const RAY_COUNT = 24;
const CENTER = 100;
const TO_RAD = Math.PI / 180;

function buildRayPath(index: number): string {
  const isLong = index % 2 === 0;
  const angleStep = 360 / RAY_COUNT;
  const angle = index * angleStep;
  const spread = angleStep * 0.32;
  const outerR = isLong ? 96 : 68;
  const innerR = 14;

  const p1x = CENTER + innerR * Math.cos((angle - spread) * TO_RAD);
  const p1y = CENTER + innerR * Math.sin((angle - spread) * TO_RAD);
  const p2x = CENTER + outerR * Math.cos(angle * TO_RAD);
  const p2y = CENTER + outerR * Math.sin(angle * TO_RAD);
  const p3x = CENTER + innerR * Math.cos((angle + spread) * TO_RAD);
  const p3y = CENTER + innerR * Math.sin((angle + spread) * TO_RAD);

  return `M${p1x.toFixed(2)},${p1y.toFixed(2)} L${p2x.toFixed(2)},${p2y.toFixed(2)} L${p3x.toFixed(2)},${p3y.toFixed(2)} Z`;
}

const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => buildRayPath(i));

/** Decorative radial burst rendered behind the brand mark. Purely presentational. */
const LogoFlare: React.FC<LogoFlareProps> = ({ className }) => {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="logoFlareCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" style={{ stopColor: 'var(--chan-blue)' }} stopOpacity="0.55" />
          <stop offset="100%" style={{ stopColor: 'var(--chan-blue)' }} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="logoFlareRay" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" style={{ stopColor: 'var(--chan-blue)' }} stopOpacity="0.9" />
          <stop offset="100%" style={{ stopColor: 'var(--chan-blue)' }} stopOpacity="0" />
        </radialGradient>
        <filter id="logoFlareGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={CENTER} cy={CENTER} r="92" fill="url(#logoFlareCore)" className="polutek-logo-flare-pulse" />

      <g className="polutek-logo-flare-spin" filter="url(#logoFlareGlow)">
        {RAYS.map((d, i) => (
          <path key={i} d={d} fill="url(#logoFlareRay)" opacity={i % 2 === 0 ? 0.85 : 0.5} />
        ))}
      </g>

      <circle cx={CENTER} cy={CENTER} r="18" fill="#ffffff" opacity="0.85" filter="url(#logoFlareGlow)" className="polutek-logo-flare-pulse" />
    </svg>
  );
};

export default LogoFlare;
