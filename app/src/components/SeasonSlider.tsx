import { MONTH_NAMES } from '../lib/plantSeasons'

interface Props {
  month: number
  onChange: (month: number) => void
}

export function SeasonSlider({ month, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(month === 1 ? 12 : month - 1)}
        className="text-stone-400 hover:text-stone-600 text-sm leading-none px-0.5"
      >‹</button>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-medium text-stone-600 w-20 text-center">
          {MONTH_NAMES[month]}
        </span>
        <input
          type="range"
          min={1}
          max={12}
          value={month}
          onChange={e => onChange(Number(e.target.value))}
          className="w-28 h-1 accent-green-600 cursor-pointer"
        />
      </div>
      <button
        onClick={() => onChange(month === 12 ? 1 : month + 1)}
        className="text-stone-400 hover:text-stone-600 text-sm leading-none px-0.5"
      >›</button>
    </div>
  )
}
