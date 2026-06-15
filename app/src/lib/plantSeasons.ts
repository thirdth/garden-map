import { Planting } from '../types'

export type PlantState = 'dormant' | 'blooming' | 'fall' | 'normal'

// NC Extension color names → CSS hex
export const NC_COLOR_MAP: Record<string, string> = {
  'White':            '#f1f5f9',
  'Pink':             '#f472b6',
  'Red/Burgundy':     '#dc2626',
  'Purple/Lavender':  '#8b5cf6',
  'Blue':             '#3b82f6',
  'Orange':           '#f97316',
  'Gold/Yellow':      '#eab308',
  'Green':            '#16a34a',
  'Cream/Tan':        '#d4b896',
  'Gray/Silver':      '#9ca3af',
  'Brown/Copper':     '#78350f',
  'Black':            '#374151',
  'Variegated':       '#16a34a',
  'Insignificant':    '#9ca3af',
}

// Which months each NC Extension season covers (1-based)
const SEASON_MONTHS: Record<string, number[]> = {
  'Spring': [3, 4, 5],
  'Summer': [6, 7, 8],
  'Fall':   [9, 10, 11],
  'Winter': [12, 1, 2],
}

export const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function plantState(p: Planting, month: number): PlantState {
  // Bloom — exact dates take priority, fall back to seasons
  const isBlooming = p.bloom_start_md && p.bloom_end_md
    ? monthInRange(month, p.bloom_start_md, p.bloom_end_md)
    : (p.bloom_seasons ?? []).some(s => SEASON_MONTHS[s]?.includes(month))

  if (isBlooming) return 'blooming'

  // Herbaceous dormancy: Dec–Feb
  if (p.life_cycle === 'Perennial' && [12, 1, 2].includes(month)) return 'dormant'

  // Woody deciduous fall color: Oct–Nov
  if (p.life_cycle === 'Woody' && (p.deciduous_fall_color?.length ?? 0) > 0 && [10, 11].includes(month)) return 'fall'

  return 'normal'
}

export function plantStateColor(p: Planting, state: PlantState, defaultFg: string): string {
  switch (state) {
    case 'dormant': return '#94a3b8'
    case 'blooming': {
      const name = p.flower_color?.[0]
      return name ? (NC_COLOR_MAP[name] ?? defaultFg) : defaultFg
    }
    case 'fall': {
      const name = p.deciduous_fall_color?.[0]
      return name ? (NC_COLOR_MAP[name] ?? '#d97706') : '#d97706'
    }
    case 'normal': {
      const name = p.leaf_color?.[0]
      return name ? (NC_COLOR_MAP[name] ?? defaultFg) : defaultFg
    }
  }
}

// MM-DD range check — handles wrap-around (e.g. Dec–Feb)
function monthInRange(month: number, startMD: string, endMD: string): boolean {
  const startM = parseInt(startMD.split('-')[0])
  const endM = parseInt(endMD.split('-')[0])
  if (startM <= endM) return month >= startM && month <= endM
  return month >= startM || month <= endM
}
