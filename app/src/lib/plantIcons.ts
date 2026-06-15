import {
  TreeDeciduous, Flower2, Flower, Sun, Grape, Leaf, Layers, Wind, Sprout,
  type LucideIcon,
} from 'lucide-react'

export const PLANT_ICON_MAP: Record<string, LucideIcon> = {
  'Tree':                  TreeDeciduous,
  'Shrub':                 Flower2,
  'Herbaceous Perennial':  Flower,
  'Annual':                Sun,
  'Vine':                  Grape,
  'Bulb':                  Leaf,
  'Fern':                  Leaf,
  'Ground Cover':          Layers,
  'Ornamental Grass':      Wind,
  'Houseplant':            Sprout,
}

export const PLANT_COLORS: Record<string, { bg: string; fg: string }> = {
  'Tree':                 { bg: '#d1fae5', fg: '#065f46' },
  'Shrub':                { bg: '#ccfbf1', fg: '#0f766e' },
  'Herbaceous Perennial': { bg: '#ede9fe', fg: '#6d28d9' },
  'Annual':               { bg: '#fef3c7', fg: '#92400e' },
  'Vine':                 { bg: '#dcfce7', fg: '#15803d' },
  'Bulb':                 { bg: '#fce7f3', fg: '#9d174d' },
  'Fern':                 { bg: '#ecfdf5', fg: '#065f46' },
  'Ground Cover':         { bg: '#f0fdf4', fg: '#166534' },
  'Ornamental Grass':     { bg: '#fef9c3', fg: '#713f12' },
  'Houseplant':           { bg: '#f0fdf4', fg: '#166534' },
}

export const DEFAULT_COLORS = { bg: '#f1f5f9', fg: '#475569' }

export function getPlantIcon(taxonomicType: string): LucideIcon {
  return PLANT_ICON_MAP[taxonomicType] ?? Sprout
}

export function getPlantColors(taxonomicType: string) {
  return PLANT_COLORS[taxonomicType] ?? DEFAULT_COLORS
}
