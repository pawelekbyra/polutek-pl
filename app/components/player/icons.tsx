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
  return <svg {...base} {...props} fill="currentColor" stroke="none"><path d="M8.5 5.6c0-1.02 1.12-1.64 1.98-1.1l9.4 5.9c.83.52.83 1.75 0 2.27l-9.4 5.9c-.86.54-1.98-.08-1.98-1.1V5.6Z" /></svg>;
}

export function PauseIcon(props: IconProps) {
  return <svg {...base} {...props} fill="currentColor" stroke="none"><rect x="6.2" y="4.8" width="4" height="14.4" rx="1.4" /><rect x="13.8" y="4.8" width="4" height="14.4" rx="1.4" /></svg>;
}

export function ReplayIcon(props: IconProps) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 1 1 2.6 5.9" /><path d="M4 12V7.5" /><path d="M4 12h4.5" /></svg>;
}

function Speaker({ children, ...props }: IconProps & { children?: React.ReactNode }) {
  return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4Z" fill="currentColor" stroke="none" />{children}</svg>;
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
  return <svg {...base} {...props} fill="currentColor" stroke="none"><path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm0 1.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" /><path d="M13.7 3.1a1.7 1.7 0 0 0-3.4 0l-.14.86a7.9 7.9 0 0 0-1.66.69l-.7-.5a1.7 1.7 0 0 0-2.36 2.36l.5.7c-.3.52-.53 1.08-.69 1.66l-.86.14a1.7 1.7 0 0 0 0 3.4l.86.14c.16.58.4 1.14.69 1.66l-.5.7a1.7 1.7 0 0 0 2.36 2.36l.7-.5c.52.3 1.08.53 1.66.69l.14.86a1.7 1.7 0 0 0 3.4 0l.14-.86c.58-.16 1.14-.4 1.66-.69l.7.5a1.7 1.7 0 0 0 2.36-2.36l-.5-.7c.3-.52.53-1.08.69-1.66l.86-.14a1.7 1.7 0 0 0 0-3.4l-.86-.14a7.9 7.9 0 0 0-.69-1.66l.5-.7a1.7 1.7 0 0 0-2.36-2.36l-.7.5a7.9 7.9 0 0 0-1.66-.69l-.14-.86Zm-1.7 3.5a5.4 5.4 0 1 1 0 10.8 5.4 5.4 0 0 1 0-10.8Z" fillRule="evenodd" /></svg>;
}

export function PipEnterIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="13" rx="2" /><rect x="12" y="10.5" width="7" height="5" rx="1.1" fill="currentColor" stroke="none" /></svg>; }
export function PipExitIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="13" rx="2" /><rect x="12" y="10.5" width="7" height="5" rx="1.1" /></svg>; }
export function FullscreenEnterIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v4" /><path d="M15 4h4a1 1 0 0 1 1 1v4" /><path d="M9 20H5a1 1 0 0 1-1-1v-4" /><path d="M15 20h4a1 1 0 0 0 1-1v-4" /></svg>; }
export function FullscreenExitIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5.5A1.5 1.5 0 0 1 4 7.5V4" /><path d="M15 9h3.5A1.5 1.5 0 0 0 20 7.5V4" /><path d="M9 15H5.5A1.5 1.5 0 0 0 4 16.5V20" /><path d="M15 15h3.5A1.5 1.5 0 0 1 20 16.5V20" /></svg>; }
export function CheckIcon(props: IconProps) { return <svg {...base} {...props} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 9 17l10.5-10.5" /></svg>; }
