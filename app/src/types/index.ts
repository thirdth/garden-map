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

export interface PlantDetail {
  id: string
  genus: string
  species: string | null
  cultivar: string | null
  family: string | null
  taxonomic_type: string
  description: string | null
  life_cycle: string | null
  height_min_ft: number | null
  height_max_ft: number | null
  spread_min_ft: number | null
  spread_max_ft: number | null
  spacing_min_ft: number | null
  spacing_max_ft: number | null
  light: string[] | null
  soil_texture: string[] | null
  soil_drainage: string[] | null
  watering_need: string | null
  growth_rate: string | null
  maintenance: string | null
  usda_hardiness_zone_min: number | null
  usda_hardiness_zone_max: number | null
  flower_color: string[] | null
  bloom_seasons: string[] | null
  bloom_window_text: string | null
  bloom_start_md: string | null
  bloom_end_md: string | null
  leaf_color: string[] | null
  deciduous_fall_color: string[] | null
  foliage_color: string | null
  dieback_start_md: string | null
  regrowth_start_md: string | null
  attracts: string[] | null
  wildlife_value: string | null
  ecological_tags: string[] | null
  plant_common_names: { name: string; is_primary: boolean }[]
}

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

// Structures: geometry and metadata for drawn objects
export type StructureKind = 'patio' | 'shed' | 'pergola' | 'path' | 'fountain' | 'deck' | 'other'
export type ShapeType = 'rectangle' | 'polygon' | 'polyline' | 'point'
export type CompassSide = 'N' | 'E' | 'S' | 'W'

export interface GridPoint {
  row: number
  col: number
}

export interface RectangleGeometry {
  shape: 'rectangle'
  anchor: GridPoint
  width: number
  height: number
  rotation?: number
}

export interface PolygonGeometry {
  shape: 'polygon'
  points: GridPoint[]
}

export interface PolylineGeometry {
  shape: 'polyline'
  points: GridPoint[]
  strokeWidth?: number
}

export interface PointGeometry {
  shape: 'point'
  point: GridPoint
}

export type StructureGeometry = RectangleGeometry | PolygonGeometry | PolylineGeometry | PointGeometry

export type PlantOverlap = 'none' | 'partial' | 'full'

export interface Structure {
  id: string
  yard_id: string
  type: StructureKind
  name?: string
  geometry: StructureGeometry
  zIndex: number
  color?: string
  pattern?: string
  allowPlantOverlap?: PlantOverlap
  growUpSides?: CompassSide[]
  notes?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  meta?: Record<string, any>
}
