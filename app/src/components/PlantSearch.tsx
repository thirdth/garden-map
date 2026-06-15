import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Plant } from '../types'
import { getPlantColors } from '../lib/plantIcons'

interface Props {
  selected: Plant | null
  onSelect: (plant: Plant | null) => void
}

function buildDisplayName(genus: string, species: string | null, cultivar: string | null): string {
  const parts = [genus, species, cultivar ? `'${cultivar}'` : null].filter(Boolean)
  return parts.join(' ') || genus
}

export function PlantSearch({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Plant[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      // Search common names first, then fall back to genus
      const [cnRes, genusRes] = await Promise.all([
        supabase
          .from('plant_common_names')
          .select('name, plant_id, plants!inner(id, genus, species, cultivar, taxonomic_type)')
          .ilike('name', `%${q}%`)
          .limit(25),
        supabase
          .from('plants')
          .select('id, genus, species, cultivar, taxonomic_type, plant_common_names(name, is_primary)')
          .ilike('genus', `%${q}%`)
          .limit(10),
      ])

      const seen = new Set<string>()
      const plants: Plant[] = []

      // Common name matches (prioritized)
      for (const cn of (cnRes.data ?? []) as any[]) {
        const p = cn.plants
        if (!seen.has(p.id)) {
          seen.add(p.id)
          plants.push({
            id: p.id,
            genus: p.genus,
            species: p.species,
            cultivar: p.cultivar,
            taxonomic_type: p.taxonomic_type,
            display_name: cn.name,
          })
        }
      }

      // Genus matches not already in results
      for (const p of (genusRes.data ?? []) as any[]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          const primary = (p.plant_common_names ?? []).find((n: any) => n.is_primary)
          plants.push({
            id: p.id,
            genus: p.genus,
            species: p.species,
            cultivar: p.cultivar,
            taxonomic_type: p.taxonomic_type,
            display_name: primary?.name ?? buildDisplayName(p.genus, p.species, p.cultivar),
          })
        }
      }

      setResults(plants.slice(0, 25))
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="flex items-start gap-3 px-3 py-2 bg-white border border-stone-200 rounded-lg shadow-sm">
      <span className="text-xs text-stone-500 mt-2 shrink-0">Plant</span>

      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or genus…"
            className="w-full pl-6 pr-2 py-1 text-xs border border-stone-200 rounded focus:outline-none focus:border-green-400"
          />
          {searching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-300">…</span>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {results.map(plant => {
              const colors = getPlantColors(plant.taxonomic_type)
              const isSelected = selected?.id === plant.id
              const scientific = buildDisplayName(plant.genus, plant.species, plant.cultivar)
              return (
                <button
                  key={plant.id}
                  onClick={() => onSelect(isSelected ? null : plant)}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-green-50 border border-green-300 text-green-800'
                      : 'hover:bg-stone-50 border border-transparent'
                  }`}
                >
                  <span
                    className="shrink-0 text-[10px] font-medium px-1 py-0.5 rounded"
                    style={{ backgroundColor: colors.bg, color: colors.fg }}
                  >
                    {plant.taxonomic_type.split(' ')[0]}
                  </span>
                  <span className="truncate text-stone-700 font-medium">{plant.display_name}</span>
                  {scientific !== plant.display_name && (
                    <span className="text-stone-400 italic truncate hidden sm:block">{scientific}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {query.trim() && !searching && results.length === 0 && (
          <p className="text-xs text-stone-400 px-1">No plants found.</p>
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-1 shrink-0 mt-1">
          <span className="text-xs text-green-700 font-medium max-w-[120px] truncate">{selected.display_name}</span>
          <button onClick={() => onSelect(null)} title="Clear" className="p-0.5 text-stone-400 hover:text-stone-600">
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
