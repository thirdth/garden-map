import { useState } from 'react'
import { Plus } from 'lucide-react'

interface Props {
  onCreate: (name: string, widthFt: number, heightFt: number, cellSizeInches: number) => Promise<void>
  compact?: boolean
}

export function CreateYardForm({ onCreate, compact = false }: Props) {
  const [name, setName] = useState('')
  const [widthFt, setWidthFt] = useState('')
  const [heightFt, setHeightFt] = useState('')
  const [cellSize, setCellSize] = useState('6')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(!compact)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !widthFt || !heightFt) return
    setSaving(true)
    setError(null)
    try {
      await onCreate(name, Number(widthFt), Number(heightFt), Number(cellSize))
      setName('')
      setWidthFt('')
      setHeightFt('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const widthCells = widthFt ? Math.round((Number(widthFt) * 12) / Number(cellSize)) : null
  const heightCells = heightFt ? Math.round((Number(heightFt) * 12) / Number(cellSize)) : null

  if (compact && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700 border border-dashed border-stone-300 rounded-lg hover:border-stone-400 transition-colors"
      >
        <Plus size={14} /> Add yard
      </button>
    )
  }

  return (
    <div className={compact ? 'bg-white border border-stone-200 rounded-xl p-4 shadow-sm w-72' : 'bg-white border border-stone-200 rounded-xl p-6 shadow-sm w-full max-w-md'}>
      {!compact && <h2 className="text-lg font-semibold text-stone-800 mb-4">Create your first yard</h2>}
      {compact && <h3 className="text-sm font-medium text-stone-700 mb-3">Add yard</h3>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Yard name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Front Yard"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Width (ft)</label>
            <input
              type="number"
              value={widthFt}
              onChange={e => setWidthFt(e.target.value)}
              placeholder="40"
              min="1"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Depth (ft)</label>
            <input
              type="number"
              value={heightFt}
              onChange={e => setHeightFt(e.target.value)}
              placeholder="30"
              min="1"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Cell size (inches)</label>
          <select
            value={cellSize}
            onChange={e => setCellSize(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="6">6 in (detailed)</option>
            <option value="12">12 in (1 ft)</option>
            <option value="24">24 in (2 ft)</option>
          </select>
        </div>
        {widthCells && heightCells && (
          <p className="text-xs text-stone-400">{widthCells} × {heightCells} cells ({widthCells * heightCells} total)</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 mt-1">
          {compact && (
            <button type="button" onClick={() => setOpen(false)} className="flex-1 px-3 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating…' : 'Create yard'}
          </button>
        </div>
      </form>
    </div>
  )
}
