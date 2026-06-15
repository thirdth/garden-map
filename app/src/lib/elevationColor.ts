// Blue for low, green at 0 (flat/explicit), amber for high
export function elevationColor(elevation: number, alpha = 0.5): string {
  if (elevation === 0) return `rgba(134,239,172,${alpha})`
  if (elevation < 0) {
    const intensity = Math.min(1, Math.abs(elevation) / 3)
    const r = Math.round(59 + (147 - 59) * (1 - intensity))
    const g = Math.round(130 + (197 - 130) * (1 - intensity))
    const b = Math.round(246 + (253 - 246) * (1 - intensity))
    return `rgba(${r},${g},${b},${alpha})`
  } else {
    const intensity = Math.min(1, elevation / 3)
    const r = Math.round(253 + (217 - 253) * intensity)
    const g = Math.round(230 + (119 - 230) * intensity)
    const b = Math.round(138 + (6 - 138) * intensity)
    return `rgba(${r},${g},${b},${alpha})`
  }
}
