import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getPlantColors } from '../lib/plantIcons'
import { PlantDetailPanel } from './PlantDetailPanel'

interface PlantRow {
  id: string
  genus: string
  species: string | null
  cultivar: string | null
  taxonomic_type: string
  height_max_ft: number | null
  light: string[] | null
  plant_common_names: { name: string; is_primary: boolean }[]
}

const TYPES = ['Tree', 'Shrub', 'Herbaceous Perennial', 'Annual', 'Vine', 'Bulb', 'Fern', 'Ground Cover', 'Ornamental Grass']

function displayName(p: PlantRow): string {
  const primary = p.plant_common_names?.find(n => n.is_primary)?.name ?? p.plant_common_names?.[0]?.name
  return primary ?? [p.genus, p.species, p.cultivar ? `'${p.cultivar}'` : null].filter(Boolean).join(' ')
}

function scientificName(p: PlantRow): string {
  return [p.genus, p.species, p.cultivar ? `'${p.cultivar}'` : null].filter(Boolean).join(' ')
}

export function PlantBrowser() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [results, setResults] = useState<PlantRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setSearching(true)
    const timer = setTimeout(async () => {
      const q = query.trim()
      let request = supabase
        .from('plants')
        .select('id, genus, species, cultivar, taxonomic_type, height_max_ft, light, plant_common_names(name, is_primary)')
        .order('genus')
        .limit(100)

      if (typeFilter) request = request.eq('taxonomic_type', typeFilter)

      if (q) {
        // Search common names, then merge genus matches
        const [cnRes, genusRes] = await Promise.all([
          supabase
            .from('plant_common_names')
            .select('plant_id, name, plants!inner(id, genus, species, cultivar, taxonomic_type, height_max_ft, light, plant_common_names(name, is_primary))')
            .ilike('name', `%${q}%`)
            .limit(60),
          request.ilike('genus', `%${q}%`),
        ])

        const seen = new Set<string>()
        const plants: PlantRow[] = []

        for (const cn of (cnRes.data ?? []) as any[]) {
          const p = cn.plants
          if (!seen.has(p.id) && (!typeFilter || p.taxonomic_type === typeFilter)) {
            seen.add(p.id)
            plants.push(p)
          }
        }
        for (const p of (genusRes.data ?? []) as any[]) {
          if (!seen.has(p.id)) { seen.add(p.id); plants.push(p) }
        }
        setResults(plants.slice(0, 80))
      } else {
        const { data } = await request
        setResults((data ?? []) as PlantRow[])
      }

      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, typeFilter])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: search + filter + list */}
      <div className="w-80 shrink-0 border-r border-stone-200 flex flex-col overflow-hidden bg-white">
        {/* Search */}
        <div className="px-3 py-3 border-b border-stone-100">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or genus…"
              className="w-full pl-6 pr-2 py-1.5 text-sm border border-stone-200 rounded focus:outline-none focus:border-green-400"
            />
            {searching && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-300">…</span>}
          </div>
        </div>

        {/* Type filter */}
        <div className="px-3 py-2 border-b border-stone-100 flex flex-wrap gap-1">
          <button
            onClick={() => setTypeFilter(null)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${!typeFilter ? 'bg-stone-700 text-white border-stone-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            All
          </button>
          {TYPES.map(t => {
            const colors = getPlantColors(t)
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className="text-[10px] px-2 py-0.5 rounded border transition-colors"
                style={typeFilter === t
                  ? { backgroundColor: colors.fg, color: 'white', borderColor: colors.fg }
                  : { backgroundColor: colors.bg, color: colors.fg, borderColor: 'transparent' }}
              >
                {t.split(' ')[0]}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && !searching && (
            <p className="text-xs text-stone-400 px-4 py-6 text-center">No plants found.</p>
          )}
          {results.map(p => {
            const colors = getPlantColors(p.taxonomic_type)
            const isSelected = p.id === selectedId
            const name = displayName(p)
            const sci = scientificName(p)
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(isSelected ? null : p.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-stone-50 transition-colors ${
                  isSelected ? 'bg-green-50 border-green-100' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 text-[9px] font-medium px-1 py-0.5 rounded"
                    style={{ backgroundColor: colors.bg, color: colors.fg }}
                  >
                    {p.taxonomic_type.split(' ')[0]}
                  </span>
                  <span className="text-xs font-medium text-stone-700 truncate">{name}</span>
                </div>
                {sci !== name && (
                  <p className="text-[10px] text-stone-400 italic mt-0.5 truncate pl-0.5">{sci}</p>
                )}
              </button>
            )
          })}
        </div>

        <div className="px-3 py-1.5 border-t border-stone-100">
          <span className="text-[10px] text-stone-400">{results.length} plant{results.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Right: detail panel or placeholder */}
      {selectedId ? (
        <PlantDetailPanel
          plantId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-stone-300 text-sm">
          Select a plant to view details
        </div>
      )}
    </div>
  )
}
