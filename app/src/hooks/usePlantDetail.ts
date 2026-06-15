import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PlantDetail } from '../types'

const PLANT_SELECT = `
  id, genus, species, cultivar, family, taxonomic_type, description, life_cycle,
  height_min_ft, height_max_ft, spread_min_ft, spread_max_ft, spacing_min_ft, spacing_max_ft,
  light, soil_texture, soil_drainage, watering_need, growth_rate, maintenance,
  usda_hardiness_zone_min, usda_hardiness_zone_max,
  flower_color, bloom_seasons, bloom_window_text, bloom_start_md, bloom_end_md,
  leaf_color, deciduous_fall_color, foliage_color, dieback_start_md, regrowth_start_md,
  attracts, wildlife_value, ecological_tags,
  plant_common_names(name, is_primary)
`

export function usePlantDetail(plantId: string | null) {
  const [plant, setPlant] = useState<PlantDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!plantId) { setPlant(null); return }
    setLoading(true)
    supabase
      .from('plants')
      .select(PLANT_SELECT)
      .eq('id', plantId)
      .single()
      .then(({ data }) => {
        setPlant(data as PlantDetail)
        setLoading(false)
      })
  }, [plantId])

  async function updatePlant(fields: Partial<PlantDetail>) {
    if (!plantId || !plant) return
    const { error } = await supabase.from('plants').update(fields).eq('id', plantId)
    if (!error) setPlant(prev => prev ? { ...prev, ...fields } : null)
  }

  return { plant, loading, updatePlant }
}
