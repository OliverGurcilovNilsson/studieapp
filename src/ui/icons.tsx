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
export const IconSkip = (p: P) => (
  <svg {...base(p)} strokeWidth={2.6}>
    <path d="m6 6 7 6-7 6M17 6v12" />
  </svg>
)
export const IconArrow = (p: P) => (
  <svg {...base(p)} strokeWidth={2.6}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const IconX = (p: P) => (
  <svg {...base(p)} strokeWidth={3}>
    <path d="M7 7l10 10M17 7 7 17" />
  </svg>
)

/** The mascot celebrating (result screens). */
export const MascotHappy = ({ size = 96 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
    <path d="M60 8v14M92 16l-8 12M110 44l-14 4M28 16l8 12M10 44l14 4" stroke="#F2C84B" strokeWidth="6" strokeLinecap="round" />
    <path d="M100 76l-12-3M20 76l12-3" stroke="#F4B9B3" strokeWidth="6" strokeLinecap="round" />
    <g transform="rotate(-35 60 74)">
      <rect x="22" y="54" width="76" height="40" rx="20" fill="#2436D9" stroke="#111114" strokeWidth="4.5" />
      <path d="M60 54H42a20 20 0 0 0 0 40h18z" fill="#fff" stroke="#111114" strokeWidth="4.5" />
    </g>
    <path d="M45 76q4-6 8 0M67 70q4-6 8 0" fill="none" stroke="#111114" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

// Illustrations from the mockups. They sit on accent fills, so they always use the fixed ink colour.
const ink = { fill: 'none', stroke: '#111114', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const DECK_ICONS = [
  <svg key="chart" width="34" height="30" viewBox="0 0 34 30" {...ink}>
    <path d="M3 3v24h28" />
    <path d="M7 21l7-8 5 4 10-12" />
  </svg>,
  <svg key="nodes" width="32" height="32" viewBox="0 0 32 32" {...ink}>
    <circle cx="8" cy="8" r="4" fill="#F2C84B" />
    <circle cx="24" cy="8" r="4" fill="#ffffff" />
    <circle cx="16" cy="25" r="4" fill="#F4B9B3" />
    <path d="M11 10l3 11M21 10l-3 11M12 8h8" />
  </svg>,
  <svg key="clipboard" width="28" height="32" viewBox="0 0 28 32" {...ink}>
    <rect x="3" y="4" width="22" height="26" rx="3" fill="#ffffff" />
    <rect x="9" y="1.5" width="10" height="5" rx="1.5" fill="#F2C84B" />
    <path d="M8 14l2 2 4-4M8 23l2 2 4-4M17 15h4M17 24h4" />
  </svg>,
  <svg key="coin" width="32" height="32" viewBox="0 0 32 32" {...ink}>
    <circle cx="16" cy="16" r="12" fill="#F2C84B" />
    <path d="M19.5 11.5c-1-1.2-2.2-1.6-3.5-1.6-2 0-3.5 1-3.5 2.8 0 4 7.2 2.2 7.2 6.4 0 1.9-1.7 3-3.7 3-1.5 0-2.8-.5-3.8-1.7M16 7.5v2.4M16 22.2v2.3" />
  </svg>,
]

/** A stable illustration per deck. */
export function DeckIcon({ seed }: { seed: string }) {
  let h = 7
  for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0
  return DECK_ICONS[h % DECK_ICONS.length]
}

export const TileIconPractice = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" {...ink}>
    <path d="M22 3 8 22h11l-2 15 15-20H21z" fill="#F2C84B" />
  </svg>
)
export const TileIconExam = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" {...ink}>
    <circle cx="20" cy="22" r="14" fill="#B7BAF6" />
    <path d="M20 14v8l5 4M16 4h8M20 4v4" />
  </svg>
)
export const TileIconMistakes = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" {...ink}>
    <rect x="5" y="8" width="26" height="28" rx="4" fill="#F4B9B3" />
    <rect x="10" y="4" width="26" height="28" rx="4" fill="#ffffff" />
    <path d="M18 13l10 10M28 13 18 23" />
  </svg>
)
export const TileIconMap = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" {...ink}>
    <path d="M4 9l10-5 12 5 10-5v27l-10 5-12-5-10 5z" fill="#A6E3C8" />
    <path d="M14 4v27M26 9v27" />
  </svg>
)
export const IconFlame = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="#F2C84B" stroke="#111114" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2.5c1.2 4.2 5.5 5.8 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.4 2.7-5.5.5 2.2 1.6 3.3 2.8 3.3 0-3.3-1.1-5.4 0-8.8z" />
  </svg>
)
export const IconCards = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#111114" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="16" height="18" rx="3" fill="#2436D9" />
    <rect x="9" y="3" width="16" height="18" rx="3" fill="#B7BAF6" />
  </svg>
)
