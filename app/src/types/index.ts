export interface Yard {
  id: string
  user_id: string
  name: string
  width_cells: number
  height_cells: number
  cell_size_inches: number
}

export interface GridCell {
  id: string
  yard_id: string
  row: number
  col: number
  elevation: number | null
  water_flow_direction: string | null
  shade_level: string | null
}

export type ShadeValue =
  | 'full_sun'
  | 'shade_1' | 'shade_1_am' | 'shade_1_pm'
  | 'shade_2' | 'shade_2_am' | 'shade_2_pm'
  | 'shade_3' | 'shade_3_am' | 'shade_3_pm'
  | 'shade_4'

export type ShadeMap = Map<string, ShadeValue>

export interface Plant {
  id: string
  genus: string
  species: string | null
  cultivar: string | null
  taxonomic_type: string
  display_name: string   // primary common name, or genus species if none
}

export interface Planting {
  id: string
  plant_id: string
  yard_id: string
  anchor_row: number
  anchor_col: number
  custom_label: string | null
  planted_date: string | null
  removed_date: string | null
  notes: string | null
  display_name: string
  taxonomic_type: string
  spread_max_ft: number | null
  growth_rate: string | null
  // Seasonal fields (from plants join)
  flower_color: string[] | null
  bloom_seasons: string[] | null
  bloom_start_md: string | null
  bloom_end_md: string | null
  leaf_color: string[] | null
  deciduous_fall_color: string[] | null
  life_cycle: string | null
}
