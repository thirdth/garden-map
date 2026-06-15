import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Planting } from '../types'

function buildDisplayName(genus: string, species: string | null, cultivar: string | null): string {
  const parts = [genus, species, cultivar ? `'${cultivar}'` : null].filter(Boolean)
  return parts.join(' ') || genus
}

export function usePlantings(yardId: string) {
  const [plantings, setPlantings] = useState<Planting[]>([])

  useEffect(() => {
    if (!yardId) return
    supabase
      .from('plantings')
      .select(`*,
        plants(
          genus, species, cultivar, taxonomic_type, spread_max_ft, growth_rate,
          flower_color, bloom_seasons, bloom_start_md, bloom_end_md,
          leaf_color, deciduous_fall_color, life_cycle,
          plant_common_names(name, is_primary)
        )`)
      .eq('yard_id', yardId)
      .is('removed_date', null)
      .then(({ data }) => {
        setPlantings((data ?? []).map(flatten))
      })
  }, [yardId])

  function flatten(p: any): Planting {
    const plant = p.plants
    const primary = (plant?.plant_common_names ?? []).find((n: any) => n.is_primary)
    return {
      ...p,
      display_name: primary?.name ?? buildDisplayName(plant?.genus, plant?.species, plant?.cultivar),
      taxonomic_type: plant?.taxonomic_type ?? '',
      spread_max_ft: plant?.spread_max_ft ?? null,
      growth_rate: plant?.growth_rate ?? null,
      flower_color: plant?.flower_color ?? null,
      bloom_seasons: plant?.bloom_seasons ?? null,
      bloom_start_md: plant?.bloom_start_md ?? null,
      bloom_end_md: plant?.bloom_end_md ?? null,
      leaf_color: plant?.leaf_color ?? null,
      deciduous_fall_color: plant?.deciduous_fall_color ?? null,
      life_cycle: plant?.life_cycle ?? null,
    }
  }

  async function addPlanting(plantId: string, _displayName: string, _taxonomicType: string, row: number, col: number) {
    const { data, error } = await supabase
      .from('plantings')
      .insert({ plant_id: plantId, yard_id: yardId, anchor_row: row, anchor_col: col })
      .select(`*,
        plants(
          genus, species, cultivar, taxonomic_type, spread_max_ft, growth_rate,
          flower_color, bloom_seasons, bloom_start_md, bloom_end_md,
          leaf_color, deciduous_fall_color, life_cycle,
          plant_common_names(name, is_primary)
        )`)
      .single()
    if (error || !data) return
    setPlantings(prev => [...prev, flatten(data)])
  }

  async function removePlanting(plantingId: string) {
    await supabase.from('plantings').delete().eq('id', plantingId)
    setPlantings(prev => prev.filter(p => p.id !== plantingId))
  }

  return { plantings, addPlanting, removePlanting }
}
