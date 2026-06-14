import { IconProps } from "./types";

const BaseIcon = ({ children, size = 24, viewBox, className, ...props }: IconProps & { viewBox: string }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

export const RotateCcw = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </BaseIcon>
);

export const Info = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </BaseIcon>
);

export const User = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const LayoutDashboard = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <rect x="3" y="3" width="7" height="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="12" width="7" height="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="3" y="16" width="7" height="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </BaseIcon>
);

export const FileText = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" />
    <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="2" />
  </BaseIcon>
);

export const History = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 7v5l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const CreditCard = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const ExternalLink = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const TrendingUp = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const TrendingDown = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17 18 23 18 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const Download = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const Eye = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const EyeOff = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const AlertTriangle = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const RefreshCcw = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="23 20 23 14 17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const GripVertical = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </BaseIcon>
);

export const Filter = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const Calendar = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const FileVideo = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="m22 8-6 4 6 4V8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="2" y="6" width="14" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const CheckCircle2 = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M12 22c5.523 0 9-4.477 9-10S17.523 2 12 2 3 6.477 3 12s3.477 10 9 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const XCircle = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m15 9-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m9 9 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const Archive = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <rect x="2" y="3" width="20" height="5" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="10" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

export const ChevronUp = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </BaseIcon>
);

export const Flag = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </BaseIcon>
);

export const Link = (props: IconProps) => (
  <BaseIcon viewBox="0 0 24 24" {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </BaseIcon>
);

export { LayoutDashboard as Layout };
