import { X } from 'lucide-react'
import { ShadeValue } from '../types'
import { shadePreviewStyle } from '../lib/shadePatterns'

const LEVELS = [
  { key: 'full_sun', label: 'Full Sun', hasTiming: false },
  { key: 'shade_1',  label: 'Light / Dappled', short: '1', hasTiming: true },
  { key: 'shade_2',  label: 'Open',             short: '2', hasTiming: true },
  { key: 'shade_3',  label: 'Medium',           short: '3', hasTiming: true },
  { key: 'shade_4',  label: 'Deep',             short: '4', hasTiming: false },
]

const TIMINGS = [
  { suffix: '',    label: 'General' },
  { suffix: '_am', label: '☀️ AM sun / PM shade' },
  { suffix: '_pm', label: '☀️ PM sun / AM shade' },
]

function parseSelected(selected: ShadeValue | null): { level: string; timing: string } {
  if (!selected) return { level: '', timing: '' }
  const ampm = selected.endsWith('_am') ? '_am' : selected.endsWith('_pm') ? '_pm' : ''
  const level = ampm ? selected.slice(0, -3) : selected
  return { level, timing: ampm }
}

interface Props {
  selected: ShadeValue | null
  onSelect: (v: ShadeValue | null) => void
  onActivate: () => void
}

export function ShadePalette({ selected, onSelect, onActivate }: Props) {
  const { level: selLevel, timing: selTiming } = parseSelected(selected)
  const activeLevel = LEVELS.find(l => l.key === selLevel)

  function selectLevel(levelKey: string, hasTiming: boolean) {
    onActivate()
    if (selLevel === levelKey && !hasTiming) {
      // clicking same no-timing level → deselect
      onSelect(null)
      return
    }
    const newVal = hasTiming
      ? `${levelKey}${selTiming || ''}` as ShadeValue
      : levelKey as ShadeValue
    onSelect(newVal)
  }

  function selectTiming(suffix: string) {
    onActivate()
    if (!selLevel || selLevel === 'full_sun' || selLevel === 'shade_4') return
    onSelect(`${selLevel}${suffix}` as ShadeValue)
  }

  return (
    <div className="flex items-start gap-3 px-3 py-2 bg-white border border-stone-200 rounded-lg shadow-sm">
      <span className="text-xs text-stone-500 mt-1.5 shrink-0">Shade</span>

      <div className="flex flex-col gap-1.5">
        {/* Level selector */}
        <div className="flex items-center gap-1">
          {LEVELS.map(({ key, label, hasTiming }) => {
            const isActive = selLevel === key
            const previewVal = (hasTiming ? `${key}${selTiming || ''}` : key) as ShadeValue
            return (
              <button
                key={key}
                title={label}
                onClick={() => selectLevel(key, hasTiming)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded border text-xs transition-all ${
                  isActive
                    ? 'border-slate-400 ring-2 ring-slate-400 ring-offset-1 scale-105 text-slate-700'
                    : 'border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <span
                  className="w-8 h-5 rounded border border-stone-200"
                  style={shadePreviewStyle(previewVal)}
                />
                <span className="leading-none">{key === 'full_sun' ? '☀️' : label.split('/')[0].trim()}</span>
              </button>
            )
          })}
        </div>

        {/* Timing sub-selector — only for shade_1, shade_2, shade_3 */}
        {activeLevel?.hasTiming && (
          <div className="flex items-center gap-1 pl-0.5">
            {TIMINGS.map(({ suffix, label }) => (
              <button
                key={suffix}
                onClick={() => selectTiming(suffix)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  selTiming === suffix
                    ? 'bg-slate-100 border-slate-400 text-slate-700 font-medium'
                    : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected !== null && (
        <button
          onClick={() => { onActivate(); onSelect(null) }}
          title="Eraser (clear shade)"
          className="mt-1 w-7 h-7 rounded flex items-center justify-center border border-dashed border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
