import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
};

export function PlayIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={2.15} strokeLinecap="round" strokeLinejoin="round"><path d="M8.1 5.2c.1-.8.9-1.1 1.6-.7l9.8 6c.8.5.7 1.5-.1 2l-9.7 6.1c-.7.5-1.6 0-1.5-.8l-.1-12.6Z" fill="currentColor" /><path d="M9.4 6.2 18 11.5" opacity={0.35} /></svg>;
}

export function PauseIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M7.2 5.2c.8-.2 2.1 0 2.5.3l-.1 13.1c-.7.3-1.7.3-2.5 0L7.2 5.2Z" fill="currentColor" /><path d="M14.3 5.4c.7-.3 1.8-.2 2.5 0l.1 13.2c-.8.3-1.8.2-2.5 0l-.1-13.2Z" fill="currentColor" /></svg>;
}

export function ReplayIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={2.15} strokeLinecap="round" strokeLinejoin="round"><path d="M4.1 11.8c.3-4.3 3.6-7.5 7.8-7.6 4.6-.1 8.1 3.4 8 7.9-.1 4.3-3.6 7.7-7.9 7.7-2.1 0-4-.8-5.4-2.1" /><path d="M4.1 11.8 4 7.1M4.1 11.8l4.6-.2" /><path d="M5.1 10.8c.8-2.9 3.4-5.2 6.7-5.4" opacity={0.32} /></svg>;
}

function Speaker({ children, ...props }: IconProps & { children?: React.ReactNode }) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4.1 9.4v5.2l3.5-.1 5.3 4.6.2-14.2-5.5 4.6-3.5-.1Z" />{children}</svg>;
}

export function VolumeHighIcon(props: IconProps) { return <Speaker {...props}><path d="M16.4 8.3a5.4 5.4 0 0 1 0 7.4" /><path d="M18.8 5.8a9 9 0 0 1 0 12.4" /></Speaker>; }
export function VolumeLowIcon(props: IconProps) { return <Speaker {...props}><path d="M16.4 9.3a3.4 3.4 0 0 1 0 5.4" /></Speaker>; }
export function VolumeMuteIcon(props: IconProps) { return <Speaker {...props}><path d="M16.2 9.8 20.4 14" /><path d="M20.4 9.8 16.2 14" /></Speaker>; }

export function SeekBackIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5.5 3.8 8l3.7 2.5" /><path d="M3.8 8h8.7a7.3 7.3 0 1 1-6.9 9.8" /><text x="12" y="16.3" fontSize="7.2" fontWeight={700} textAnchor="middle" fill="currentColor" stroke="none" fontFamily="inherit">10</text></svg>;
}

export function SeekForwardIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 5.5 20.2 8l-3.7 2.5" /><path d="M20.2 8h-8.7a7.3 7.3 0 1 0 6.9 9.8" /><text x="12" y="16.3" fontSize="7.2" fontWeight={700} textAnchor="middle" fill="currentColor" stroke="none" fontFamily="inherit">10</text></svg>;
}

export function CaptionsOnIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.6" /><text x="7.6" y="14.6" fontSize="6.6" fontWeight={800} fill="currentColor" stroke="none" fontFamily="inherit">CC</text></svg>; }
export function CaptionsOffIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.6" opacity={0.55} /><text x="7.6" y="14.6" fontSize="6.6" fontWeight={800} fill="currentColor" stroke="none" fontFamily="inherit" opacity={0.55}>CC</text><path d="M3.5 4.5 20.5 19.5" /></svg>; }

export function SettingsIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="m10.2 3.5.7-1.2h2.3l.6 1.4 1.7.7 1.5-.5 1.6 1.7-.6 1.5.7 1.6 1.5.7v2.4l-1.5.6-.7 1.7.6 1.5-1.7 1.7-1.5-.6-1.7.7-.6 1.5h-2.4l-.6-1.5-1.7-.7-1.5.6-1.6-1.7.5-1.5-.7-1.6-1.5-.7V9.4l1.5-.6.7-1.7-.5-1.5 1.6-1.7 1.5.6 1.8-1Z" /><path d="M15.3 11.4c.1 2-1.4 3.5-3.3 3.6-2 .1-3.5-1.4-3.5-3.4-.1-1.9 1.4-3.4 3.3-3.5 1.9 0 3.4 1.4 3.5 3.3Z" /></svg>;
}

export function PipEnterIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="13" rx="2" /><rect x="12" y="10.5" width="7" height="5" rx="1.1" fill="currentColor" stroke="none" /></svg>; }
export function PipExitIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="13" rx="2" /><rect x="12" y="10.5" width="7" height="5" rx="1.1" /></svg>; }
export function FullscreenEnterIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v4" /><path d="M15 4h4a1 1 0 0 1 1 1v4" /><path d="M9 20H5a1 1 0 0 1-1-1v-4" /><path d="M15 20h4a1 1 0 0 0 1-1v-4" /></svg>; }
export function FullscreenExitIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5.5A1.5 1.5 0 0 1 4 7.5V4" /><path d="M15 9h3.5A1.5 1.5 0 0 0 20 7.5V4" /><path d="M9 15H5.5A1.5 1.5 0 0 0 4 16.5V20" /><path d="M15 15h3.5A1.5 1.5 0 0 1 20 16.5V20" /></svg>; }
export function CheckIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 9 17l10.5-10.5" /></svg>; }
