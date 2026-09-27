// Swedish display names for topic ids. Unknown ids fall back to a readable version of the id,
// so a future course works without code changes.
const NAMES: Record<string, string> = {
  'intro-studiedesigner': 'Studiedesigner',
  'deskriptiva-studier': 'Deskriptiva studier',
  'analytiska-studier': 'Analytiska studier',
  interventionsstudier: 'Interventionsstudier',
  forekomstmatt: 'Förekomstmått',
  effektmatt: 'Effektmått',
  validitetsmatt: 'Validitetsmått',
  'bias-confounding': 'Bias & confounding',
  'lakemedelsanvandning-ddd': 'DDD & läkemedelsanvändning',
  'atc-klassifikation': 'ATC & klassifikation',
  'primara-datakallor': 'Primära datakällor',
  'sekundara-datakallor': 'Sekundära datakällor',
  foljsamhet: 'Följsamhet',
  forskningsetik: 'Forskningsetik',
  folkhalsa: 'Folkhälsa',
  'halsoekonomi-intro': 'Hälsoekonomi',
  'ekonomi-sjukvard': 'Ekonomi i vården',
  artikelgranskning: 'Artikelgranskning',
}

export function topicName(id: string): string {
  return NAMES[id] ?? id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

const DECK_COLORS = ['var(--yellow)', 'var(--lavender)', 'var(--pink)', 'var(--mint)', 'var(--peri)']

/** Stable pastel per topic, like the mockup's deck cards. */
export function topicColor(id: string): string {
  // FNV-1a: a plain sum-like hash spreads similar ids over too few colours.
  let h = 0x811c9dc5
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return DECK_COLORS[h % DECK_COLORS.length]
}
