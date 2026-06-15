import { X } from 'lucide-react'
import { WaterFlowDir } from '../hooks/useWaterFlow'

const ARROW: Record<WaterFlowDir, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
  NONE: '—', POOLING: '◉',
}

// Compass rose layout: [NW, N, NE, W, null, E, SW, S, SE]
const COMPASS: (WaterFlowDir | null)[] = [
  'NW', 'N',    'NE',
  'W',   null,  'E',
  'SW', 'S',    'SE',
]

interface Props {
  selected: WaterFlowDir | null
  onSelect: (v: WaterFlowDir | null) => void
}

export function WaterFlowPalette({ selected, onSelect }: Props) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white border border-stone-200 rounded-lg shadow-sm">
      <span className="text-xs text-stone-500">Flow</span>

      {/* Compass rose */}
      <div className="grid grid-cols-3 gap-0.5">
        {COMPASS.map((dir, i) =>
          dir === null ? (
            <div key={i} className="w-7 h-7" />
          ) : (
            <button
              key={dir}
              title={dir}
              onClick={() => onSelect(selected === dir ? null : dir)}
              className={`w-7 h-7 rounded flex items-center justify-center text-sm border transition-all ${
                selected === dir
                  ? 'bg-blue-100 border-blue-400 text-blue-700 ring-2 ring-blue-400 ring-offset-1 scale-110'
                  : 'border-stone-200 text-stone-600 hover:bg-blue-50 hover:border-blue-200'
              }`}
            >
              {ARROW[dir]}
            </button>
          )
        )}
      </div>

      <div className="h-8 w-px bg-stone-200" />

      {/* NONE + POOLING */}
      <div className="flex flex-col gap-0.5">
        {(['NONE', 'POOLING'] as WaterFlowDir[]).map(dir => (
          <button
            key={dir}
            title={dir === 'NONE' ? 'No flow' : 'Pooling'}
            onClick={() => onSelect(selected === dir ? null : dir)}
            className={`px-2 h-7 rounded flex items-center gap-1 text-xs border transition-all ${
              selected === dir
                ? 'bg-blue-100 border-blue-400 text-blue-700 ring-2 ring-blue-400 ring-offset-1'
                : 'border-stone-200 text-stone-600 hover:bg-blue-50 hover:border-blue-200'
            }`}
          >
            <span>{ARROW[dir]}</span>
            <span>{dir === 'NONE' ? 'None' : 'Pool'}</span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <button
          onClick={() => onSelect(null)}
          title="Eraser (clear flow)"
          className="w-7 h-7 rounded flex items-center justify-center border border-dashed border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
