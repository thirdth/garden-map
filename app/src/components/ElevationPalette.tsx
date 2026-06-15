import { elevationColor } from '../lib/elevationColor'
import { X } from 'lucide-react'

const LEVELS = [-3, -2, -1, 0, 1, 2, 3] as const

const LABELS: Record<number, string> = {
  '-3': 'Low',
  '-2': 'Slight low',
  '-1': 'Very slight low',
  '0': 'Flat',
  '1': 'Very slight high',
  '2': 'Slight high',
  '3': 'High',
}

interface Props {
  selected: number | null
  onSelect: (v: number | null) => void
}

export function ElevationPalette({ selected, onSelect }: Props) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg shadow-sm">
      <span className="text-xs text-stone-500 mr-1">Elevation</span>
      {LEVELS.map(level => (
        <button
          key={level}
          title={`${LABELS[level]} (${level > 0 ? '+' : ''}${level})`}
          onClick={() => onSelect(selected === level ? null : level)}
          className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium border transition-all ${
            selected === level
              ? 'border-stone-400 ring-2 ring-stone-400 ring-offset-1 scale-110'
              : 'border-stone-200 hover:border-stone-300'
          }`}
          style={{ backgroundColor: elevationColor(level, 0.85) }}
        >
          {level > 0 ? '+' : ''}{level}
        </button>
      ))}
      {selected !== null && (
        <button
          onClick={() => onSelect(null)}
          title="Eraser (clear elevation)"
          className="ml-1 w-7 h-7 rounded flex items-center justify-center border border-dashed border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
