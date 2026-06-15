import { ShadeValue } from '../types'

// Visual config for each shade value.
// Hatching uses patternTransform="rotate(45)" which turns:
//   vertical lines → right diagonal (/) = PM shade
//   vertical lines → left diagonal (\) = AM shade  (rotate(-45))
//   both → crosshatch (×) = general shade

export interface ShadePatternConfig {
  type: 'solid' | 'hatch' | 'crosshatch'
  spacing: number
  angle: number       // 45 = /, -45 = \, ignored for solid/crosshatch
  strokeWidth: number
  opacity: number
  fill?: string       // only for 'solid'
  stroke: string
}

export const SHADE_CONFIG: Record<ShadeValue, ShadePatternConfig> = {
  full_sun:   { type: 'solid',      spacing: 0,  angle:   0, strokeWidth: 0,   opacity: 0.25, fill: 'rgb(253,230,138)', stroke: '' },
  shade_1:    { type: 'crosshatch', spacing: 10, angle:  45, strokeWidth: 0.7, opacity: 0.45, stroke: '#475569' },
  shade_1_am: { type: 'hatch',      spacing: 10, angle: -45, strokeWidth: 0.7, opacity: 0.45, stroke: '#475569' },
  shade_1_pm: { type: 'hatch',      spacing: 10, angle:  45, strokeWidth: 0.7, opacity: 0.45, stroke: '#475569' },
  shade_2:    { type: 'crosshatch', spacing: 7,  angle:  45, strokeWidth: 0.8, opacity: 0.50, stroke: '#475569' },
  shade_2_am: { type: 'hatch',      spacing: 7,  angle: -45, strokeWidth: 0.8, opacity: 0.50, stroke: '#475569' },
  shade_2_pm: { type: 'hatch',      spacing: 7,  angle:  45, strokeWidth: 0.8, opacity: 0.50, stroke: '#475569' },
  shade_3:    { type: 'crosshatch', spacing: 5,  angle:  45, strokeWidth: 1.0, opacity: 0.55, stroke: '#475569' },
  shade_3_am: { type: 'hatch',      spacing: 5,  angle: -45, strokeWidth: 1.0, opacity: 0.55, stroke: '#475569' },
  shade_3_pm: { type: 'hatch',      spacing: 5,  angle:  45, strokeWidth: 1.0, opacity: 0.55, stroke: '#475569' },
  shade_4:    { type: 'crosshatch', spacing: 3,  angle:  45, strokeWidth: 1.2, opacity: 0.65, stroke: '#475569' },
}

export function shadePatternId(value: ShadeValue, yardId: string) {
  return `shade-${value}-${yardId}`
}

// Tiny SVG preview for palette buttons (20×20)
export function shadePreviewStyle(value: ShadeValue): React.CSSProperties {
  const cfg = SHADE_CONFIG[value]
  if (cfg.type === 'solid') {
    return { backgroundColor: cfg.fill, opacity: cfg.opacity + 0.4 }
  }
  // For hatch/crosshatch, use CSS background-image as a preview approximation
  const color = 'rgba(71,85,105,0.7)'
  if (cfg.type === 'hatch') {
    const deg = cfg.angle === 45 ? '135deg' : '45deg'
    return {
      backgroundImage: `repeating-linear-gradient(${deg}, ${color}, ${color} 1px, transparent 1px, transparent ${cfg.spacing}px)`,
    }
  }
  return {
    backgroundImage: [
      `repeating-linear-gradient(135deg, ${color}, ${color} 1px, transparent 1px, transparent ${cfg.spacing}px)`,
      `repeating-linear-gradient(45deg, ${color}, ${color} 1px, transparent 1px, transparent ${cfg.spacing}px)`,
    ].join(', '),
  }
}
