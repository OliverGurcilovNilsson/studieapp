import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const IconLibrary = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="3" y="3" width="8" height="8" rx="2.5" />
    <rect x="13" y="3" width="8" height="8" rx="2.5" />
    <rect x="3" y="13" width="8" height="8" rx="2.5" />
    <rect x="13" y="13" width="8" height="8" rx="2.5" />
  </svg>
)
export const IconBolt = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
)
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconClose = (p: P) => (
  <svg {...base(p)} strokeWidth={2.6}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconBack = (p: P) => (
  <svg {...base(p)} strokeWidth={2.6}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...base(p)} strokeWidth={3}>
    <path d="m5 12 5 5 9-10" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)} strokeWidth={2.6}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconAlert = (p: P) => (
  <svg {...base(p)} width={26} height={26} fill="var(--orange)" stroke="var(--on-accent)" strokeWidth={1.8}>
    <path d="M12 3 2 20.5h20z" />
    <path d="M12 10v4.5M12 17.3v.2" strokeWidth={2.4} />
  </svg>
)
export const IconSeal = (p: P) => (
  <svg {...base(p)} fill="var(--blue)" stroke="var(--on-accent)" strokeWidth={1.6}>
    <path d="M12 2l2.6 2.2 3.4-.4.9 3.3 3 1.7-1.3 3.2 1.3 3.2-3 1.7-.9 3.3-3.4-.4L12 22l-2.6-2.2-3.4.4-.9-3.3-3-1.7 1.3-3.2L2.1 8.8l3-1.7.9-3.3 3.4.4z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" stroke="#fff" strokeWidth={2.2} />
  </svg>
)

/** The mascot: a capsule with eyes. */
export const Mascot = ({ size = 64 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
    <g transform="rotate(-35 60 60)">
      <rect x="14" y="36" width="92" height="48" rx="24" fill="#2436D9" stroke="#111114" strokeWidth="5" />
      <path d="M60 36H38a24 24 0 0 0 0 48h22z" fill="#fff" stroke="#111114" strokeWidth="5" />
    </g>
    <ellipse cx="49" cy="62" rx="9" ry="11" fill="#fff" stroke="#111114" strokeWidth="4" />
    <circle cx="51" cy="64" r="4.5" fill="#111114" />
    <ellipse cx="73" cy="56" rx="9" ry="11" fill="#fff" stroke="#111114" strokeWidth="4" />
    <circle cx="75" cy="58" r="4.5" fill="#111114" />
  </svg>
)
