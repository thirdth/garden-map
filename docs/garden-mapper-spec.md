# Garden Mapper — Build Spec

This spec covers the yard-grid mapping app: visual grid of front/back yards, plant placements with seasonal rendering, elevation/water-flow overlays, and non-plant yard features (sheds, patios, etc.). The `plants` reference table (species/cultivar data seeded from Perenual/Trefle/USDA) is already built and out of scope here — this spec covers the new tables and the frontend app built on top of it.

## Infrastructure

Use the same Supabase setup as the existing `plants` database — local development via Supabase CLI/local stack, migrations tracked in the repo, pushed to the Supabase cloud project. All new tables below should follow the existing migration pattern (new migration files, not manual schema edits in the dashboard). If a `supabase/migrations` directory and config already exist in the repo, add to it; do not create a second Supabase project.

---

## 1. Schema

### `yards`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | e.g. "Front Yard", "Back Yard" |
| width_cells | int | |
| height_cells | int | |
| cell_size_inches | numeric | e.g. 6 |

Two rows expected initially (front, back), but design for N yards.

### `grid_cells`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| yard_id | uuid, fk -> yards | |
| row | int | |
| col | int | |
| elevation | smallint, nullable | relative scale, e.g. -10 to 10 |
| water_flow_direction | enum, nullable | N, NE, E, SE, S, SW, W, NW, NONE, POOLING |

Unique constraint on (yard_id, row, col). Cells can be created lazily (on first edit) or pre-populated for the full grid — pre-populating is simpler for querying/rendering.

### `plant_category_icons`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| taxonomic_type | text | Tree, Shrub, Herbaceous Perennial, Vine, Annual, etc. |
| icon_reference | text | identifier/path for default icon |

### `plantings`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| plant_id | uuid, fk -> plants | |
| yard_id | uuid, fk -> yards | |
| anchor_row | int | |
| anchor_col | int | |
| custom_label | text, nullable | e.g. "the one by the mailbox" |
| planted_date | date, nullable | |
| removed_date | date, nullable | null = currently active |
| removal_reason | text, nullable | died, removed, replaced, etc. |
| notes | text, nullable | |

Active plantings = `removed_date IS NULL`. Historical plantings remain queryable for past-state views.

### `feature_category_icons`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| feature_type | text | shed, patio, deck, fence, table, fire_pit, path, pond, birdbath, planter_box, etc. |
| render_mode | enum | point, area |
| icon_reference | text | |

### `yard_features`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| yard_id | uuid, fk -> yards | |
| feature_type | text | fk-like ref to feature_category_icons.feature_type |
| render_mode | enum | point, area (defaults from feature_category_icons but stored for override) |
| anchor_row | int | top-left for area, position for point |
| anchor_col | int | |
| width_cells | int, nullable | area features only |
| height_cells | int, nullable | area features only |
| rotation_degrees | int | 0-359, default 0 |
| label | text, nullable | |
| notes | text, nullable | |
| z_layer | int, nullable | override default layering if needed |

---

## 2. `plants` table additions (seasonal/calendar fields)

These extend the existing `plants` table:

| column | type | notes |
|---|---|---|
| default_icon | text, nullable | custom icon reference, falls back to plant_category_icons by taxonomic_type |
| bloom_start_md | text (MM-DD), nullable | structured, for calendar computation |
| bloom_end_md | text (MM-DD), nullable | structured, for calendar computation |
| foliage_color | text, nullable | normal/non-blooming render color |
| dieback_start_md | text (MM-DD), nullable | herbaceous perennials only; null = doesn't die back |
| regrowth_start_md | text (MM-DD), nullable | herbaceous perennials only |

(`flower_color`, `bloom_window_text` (free text), `bloom_seasons`, and fall color fields already exist per the prior attribute spec — confirm exact column names against the existing schema before writing migrations.)

---

## 3. Rendering logic

### Layer order (back to front)
1. Grid base (cell borders)
2. Elevation overlay (toggle) — color-coded fill per cell based on `elevation`
3. Area features (patio, deck, paths, pond) — hardscape, rendered as filled/textured polygons with `rotation_degrees` applied
4. Plantings — icons with seasonal state (see below)
5. Point features (shed, table, fire pit, birdbath) — icons at anchor cell
6. Water flow overlay (toggle) — arrow glyphs per cell based on `water_flow_direction`

### Plant rendering per selected date
For each active planting (`removed_date IS NULL`), given a selected calendar date:

1. **Dormancy check**: if `dieback_start_md`/`regrowth_start_md` are set and the date falls in that range -> render dimmed/grayed, scaled to ~30-40% size, positioned at anchor (visible but minimized).
2. **Bloom check**: else if date falls within `bloom_start_md`–`bloom_end_md` -> render in `flower_color`.
3. **Fall color check**: else if woody deciduous and date falls in a fall window -> render in fall color field.
4. **Default**: else render in `foliage_color`.

### Size scaling (independent of color state)
`size_fraction = min(1.0, years_since_planted / years_to_maturity)`, where `years_to_maturity` is a lookup from `growth_rate`:
- Slow -> 7 years
- Medium -> 4 years
- Rapid -> 2 years

(Placeholder values — refine with plant expert input later.) Footprint radius = `(plant.spread * size_fraction) / cell_size_inches`, centered on anchor cell. Footprints are visual only — not "claimed," overlapping footprints are allowed (e.g., tree canopy over groundcover).

### Icons
- Plants: `plants.default_icon` if set, else `plant_category_icons` lookup by `taxonomic_type`. Icon assignment is per-species (reusable across all plantings of that species).
- Features: `yard_features` icon override if set, else `feature_category_icons` lookup by `feature_type`. Point features render icon at anchor; area features render filled polygon (+ optional centered icon/label).

### Date control
Single date slider/picker (default: today). Changing the date re-evaluates plant rendering logic for all active plantings and re-renders. No animation needed for v1 — recompute on change.

---

## 4. Frontend / UI

- Grid renders as SVG or canvas. Zoom via viewBox/transform scaling; pan via drag.
- Yard switcher (Front/Back, extensible to more yards).
- Overlay toggles: Elevation, Water Flow (independent on/off).
- Date slider/picker above the grid, drives plant seasonal rendering.
- At low zoom, icons may simplify (dots/category colors); at higher zoom, full icons + labels.
- Click/tap a planting or feature to view/edit details (plant info, planting date, notes, removal).

---

## 5. Suggested build order

1. `yards` + `grid_cells` tables; basic grid renders (no plants/features yet)
2. Elevation overlay toggle
3. Water flow overlay toggle
4. `plantings` table + plant icon rendering (category icons first, custom icons later)
5. Seasonal/calendar rendering (bloom/dieback/fall color + date slider)
6. Growth size scaling
7. `yard_features` + `feature_category_icons`; point and area feature rendering
8. Zoom/pan
9. Planting history/removal UI; click-to-edit detail views

---

## 6. Open items / assumptions to validate during build

- Confirm exact column names already present in `plants` for flower color, bloom season, and fall color fields before adding the new seasonal columns — avoid duplicates.
- Pre-populate `grid_cells` for the full yard grid vs. lazy creation on first edit — recommend pre-populating for simpler queries.
- `years_to_maturity` lookup values are placeholders; revisit with domain expert.
- Fall color window (currently informal) may need its own structured date range field similar to bloom, if precision matters.
