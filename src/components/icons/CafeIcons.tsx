// All icons are designed to be used with `currentColor` to inherit colors.

const iconProps = {
  strokeWidth: "2",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

export const MapleMatchaLatteIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} {...iconProps}>
    <path d="M12 20h24v18H12z" stroke="currentColor" />
    <path d="M36 26c4.42 0 8 3.58 8 8s-3.58 8-8 8" stroke="currentColor" />
    <path d="M24 20v-8m-4.24-2.24L24 12l4.24-2.24M24 4s-4 4-4 8h8c0-4-4-4-4-4z" stroke="currentColor" />
  </svg>
);

export const DalgonaCoffeeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} {...iconProps}>
    <path d="M10 20h28v18H10z" stroke="currentColor" />
    <path d="M38 26c4.42 0 8 3.58 8 8s-3.58 8-8 8" stroke="currentColor" />
    <path d="M24 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" stroke="currentColor" />
    <path d="M20 10h8" stroke="currentColor" />
    <path d="M24 6v8" stroke="currentColor" />
  </svg>
);

export const LondonFogIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} {...iconProps}>
    <path d="M12 18h24v20H12z" stroke="currentColor" />
    <path d="M36 24c4.42 0 8 3.58 8 8s-3.58 8-8 8" stroke="currentColor" />
    <path d="M24 18V8" stroke="currentColor" />
    <path d="M20 8h8v4h-8z" stroke="currentColor" />
  </svg>
);

export const AppleCiderChaiIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} {...iconProps}>
    <path d="M10 22h28v16H10z" stroke="currentColor" />
    <path d="M38 28c4.42 0 8 3.58 8 8s-3.58 8-8 8" stroke="currentColor" />
    <path d="M24 22c0-8.84-7.16-16-16-16" stroke="currentColor" />
    <path d="M24 6s-2 2-2 4h4c0-2-2-2-2-2z" stroke="currentColor" />
    <path d="M18 10s-2 2-2 4h4c0-2-2-2-2-2z" stroke="currentColor" />
    <path d="M30 14s-2 2-2 4h4c0-2-2-2-2-2z" stroke="currentColor" />
  </svg>
);
