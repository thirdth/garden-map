# Garden Mapper — App Build Plan

This document captures the technical decisions, architecture, and build sequence for the Garden Mapper frontend. Updated June 2026 to reflect current state and near-future roadmap.

---

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Vite + React + TypeScript | No SSR needed; fast dev server; SVG grid works naturally in React |
| Styling | Tailwind CSS v4 | Utility-first, good for dense UI; no config file needed in v4 |
| Icons | Lucide React | Tree-shakeable, TypeScript types, consistent style; pairs naturally with Tailwind |
| Database client | supabase-js | Direct DB queries; no API layer needed for v1 |
| Grid rendering | SVG | Native viewBox zoom/pan; hit-testing on click is straightforward |
| Hosting | Vercel | GitHub auto-deploy; native Supabase env var injection |
| Auth | Supabase Auth — Google OAuth | Already in Supabase; no extra service; unlocks RLS |

### Icon mapping

`icon_reference` in `plant_category_icons` and `feature_category_icons` stores a Lucide icon name as a string. The frontend resolves it to the React component via a lookup map — swapping icons later (or adding custom SVGs) requires only a data change, not a code change.

**Plant categories:**

| Taxonomic type | Lucide icon |
|---|---|
| Tree | `Tree` |
| Shrub | `Flower2` |
| Herbaceous Perennial | `Flower` |
| Annual | `Sun` |
| Vine | `Grape` |
| Bulb | `Leaf` |
| Fern | `Leaf` |
| Ground Cover | `Layers` |
| Ornamental Grass | `Wind` |
| Houseplant | `Sprout` |

**Yard features / structures:**

| Feature type | Lucide icon |
|---|---|
| shed | `Home` |
| patio / deck | `Square` |
| fence | `Fence` |
| table | `Table` |
| fire_pit | `Flame` |
| path | `Route` |
| pond | `Waves` |
| birdbath | `Bird` |
| planter_box | `Sprout` |
| pergola | `Columns` |
| fountain | `Droplets` |

---

## Repository Layout

```
garden-map/
├── app/                              ← Vite + React frontend
│   ├── src/
│   │   ├── App.tsx                   ← Auth gate + email whitelist
│   │   ├── components/
│   │   │   ├── GardenApp.tsx         ← Main shell (tabs, yard switcher, overlays)
│   │   │   ├── YardGrid.tsx          ← SVG grid canvas (550+ lines; rendering core)
│   │   │   ├── SignIn.tsx
│   │   │   ├── CreateYardForm.tsx
│   │   │   ├── PlantBrowser.tsx
│   │   │   ├── PlantSearch.tsx
│   │   │   ├── PlantDetailPanel.tsx
│   │   │   ├── SeasonSlider.tsx
│   │   │   ├── ElevationPalette.tsx
│   │   │   ├── WaterFlowPalette.tsx
│   │   │   └── ShadePalette.tsx
│   │   ├── hooks/
│   │   │   ├── useYards.ts
│   │   │   ├── usePlantings.ts
│   │   │   ├── useElevation.ts       ← Debounced batch writes (300ms)
│   │   │   ├── useWaterFlow.ts       ← Debounced batch writes (300ms)
│   │   │   ├── useShade.ts           ← Debounced batch writes (300ms)
│   │   │   └── usePlantDetail.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── plantIcons.ts
│   │   │   ├── plantSeasons.ts
│   │   │   ├── elevationColor.ts
│   │   │   ├── shadePatterns.ts
│   │   │   └── structures.ts         ← CRUD + realtime subscribe
│   │   └── types/index.ts
│   ├── vite.config.ts
│   └── package.json
├── docs/
│   ├── app-build-plan.md             ← This file
│   └── plant-attribute-review.md
├── supabase/
│   └── migrations/                   ← Numbered SQL migration files
└── vercel.json
```

---

## Infrastructure

- Same Supabase project as the plant database (`damubjvzwnzhjnbdmngs`)
- All schema changes go through numbered migration files in `supabase/migrations/`
- Deploy via `supabase db push` — no manual dashboard edits
- Vercel project linked to the GitHub repo; auto-deploys on push to `main`
- Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) injected by Vercel's native Supabase integration
- `VITE_ALLOWED_EMAILS` gates access during private beta (comma-separated list)

---

## Auth & User Model

- **Provider**: Google OAuth via Supabase Auth
- **Sign-in flow**: Redirect to Google → return to app → session stored in supabase-js
- **User scope**: Each user owns their own yards and plantings. RLS is designed for multi-user from the start.
- **`plants` table**: Public read-only — reference data, no RLS needed.
- **App tables**: RLS enabled on `yards`, `grid_cells`, `plantings`, `structures`. Policies scope all reads/writes to `auth.uid()`.
- **Current access model**: Email whitelist via env var — simple gate, no registration flow.

### Future: Yard Sharing

The structures table already has `created_by UUID`. The natural next step is a `yard_members` join table:

```sql
CREATE TABLE yard_members (
  yard_id    UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer',  -- 'owner' | 'collaborator' | 'viewer'
  invited_by UUID REFERENCES auth.users(id),
  joined_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (yard_id, user_id)
);
```

RLS policies would then scope to `yard_members` membership rather than direct `user_id` ownership. The invite flow would be email-based (Supabase magic link or OAuth).

---

## Database Schema (Current State)

### Tables

| Table | Purpose | User-scoped? |
|-------|---------|---|
| `yards` | Garden definitions (dimensions, name) | Yes (RLS via user_id) |
| `grid_cells` | Elevation, water flow, shade per cell | Yes (via yard FK) |
| `plantings` | Placed plants (active + historical soft deletes) | Yes (via yard FK) |
| `structures` | Drawn features (patios, sheds, paths, etc.) | Yes (via yard FK) |
| `plants` | Reference plant catalog | No (public read) |
| `plant_common_names` | Common name aliases for search | No (public read) |
| `plant_category_icons` | Lucide icon name per taxonomic type | No (public read) |
| `feature_category_icons` | Lucide icon name per feature type | No (public read) |
| `yard_features` | Legacy — superseded by `structures` | Yes |

### Migration History

| File | Contents |
|------|---------|
| `20260614000000_initial_schema.sql` | Plant reference DB + auth |
| `20260615000001_app_tables.sql` | yards, grid_cells, plantings, yard_features, RLS |
| `20260615000002_plants_seasonal_fields.sql` | bloom_start_md, bloom_end_md, dieback/regrowth fields |
| `20260615000003_grid_shade.sql` | shade_level column on grid_cells |
| `20260615000004_public_read_policies.sql` | Public read policies for reference tables |
| `20260630000000_create_structures_table.sql` | structures table + realtime subscriptions |

### Structures Table

```sql
CREATE TABLE structures (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id            UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  type               TEXT NOT NULL,         -- 'patio'|'shed'|'pergola'|'path'|'fountain'|'deck'|'other'
  name               TEXT,
  geometry           JSONB NOT NULL,        -- RectangleGeometry | PolygonGeometry | PolylineGeometry | PointGeometry
  z_index            INT DEFAULT 0,
  color              TEXT,
  pattern            TEXT,
  allow_plant_overlap TEXT DEFAULT 'full',  -- 'none'|'partial'|'full'
  grow_up_sides      TEXT[] DEFAULT '{}',   -- compass sides where climbing plants attach
  meta               JSONB DEFAULT '{}',
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
```

Geometry variants (stored as JSONB):
```typescript
// Rectangle — most common for patios, sheds, decks
{ shape: 'rectangle', anchor: { row, col }, width, height, rotation? }

// Polygon — irregular beds, ponds, custom shapes
{ shape: 'polygon', points: [{ row, col }, ...] }

// Polyline — paths, fences
{ shape: 'polyline', points: [{ row, col }, ...] }

// Point — fountains, birdbaths, fire pits
{ shape: 'point', anchor: { row, col } }
```

### Recent structure work

- Added support for non-rectangular structure geometries: `polygon`, `polyline`, and `point`.
- Refactored `YardGrid` to receive `structures` and structure callbacks from `GardenApp` instead of managing structure persistence locally.
- Added `StructureLayer.tsx` for dedicated structure rendering and vertex drag interactivity.
- Added `useStructures.ts` and `structureUtils.ts` for centralized structure CRUD, realtime subscription, and hit-testing.
- No Supabase schema change was required for this feature because `structures.geometry` is already stored as `jsonb`.

---

## Rendering Logic

### Layer order (back → front)

1. Grid base (cell borders)
2. Elevation overlay (toggle) — color fill per cell
3. Shade overlay (toggle) — SVG hatch/crosshatch patterns per cell
4. Structures — area types (patio, deck, path, pond) below plants
5. Plantings — icons with seasonal state + growth scaling
6. Structures — point types (shed, fountain, fire pit) above plants
7. Water flow overlay (toggle) — directional arrows per cell

### Plant seasonal state (given selected month)

```
if dieback_start_md/regrowth_start_md set AND date in dormancy range
  → render dimmed, ~35% size (herbaceous perennials)
else if date in bloom_start_md–bloom_end_md
  → render in flower_color
else if woody deciduous AND date in Oct–Nov AND deciduous_fall_color set
  → render in deciduous_fall_color
else
  → render in foliage_color / default icon color
```

### Size scaling

```
years_to_maturity = { Slow: 7, Medium: 4, Rapid: 2 }
size_fraction = min(1.0, years_since_planted / years_to_maturity)
footprint_radius_cells = (spread_max_ft * 12 * size_fraction) / cell_size_inches
```

Footprints are visual only — overlapping is allowed (tree canopy over groundcover).

---

## What's Built (Completed Steps)

| Step | Status | Notes |
|------|--------|-------|
| Migrations + RLS + Google OAuth | ✅ Done | All 6 migrations applied |
| Vite + React + TS scaffold | ✅ Done | Vercel connected and auto-deploying |
| Yard switcher UI + SVG grid | ✅ Done | 18px cells, pan/zoom, yard name display |
| Elevation overlay | ✅ Done | Color gradient, debounced batch writes |
| Water flow overlay | ✅ Done | 8-direction compass + NONE/POOLING |
| Plant placement (icons + anchor) | ✅ Done | Search, place, seasonal render |
| Seasonal/calendar rendering | ✅ Done | Month slider, bloom/dormancy/fall state |
| Growth size scaling | ✅ Done | years_since_planted / years_to_maturity |
| Shade overlay | ✅ Done | SVG hatch patterns, AM/PM variants |
| Plant detail view | ✅ Done | Click-to-edit label/date/notes, remove |
| Plant browser sidebar | ✅ Done | Search + type filter |
| Structures DB + realtime | ✅ Done | Table + supabase channel subscriptions |

---

## Roadmap

Priority order reflects product discovery (June 2026): the primary use case is planning/design, the co-editor (Kira) will primarily use mobile, and her main hook is visual plant combination planning. The app is personal/family now but intended as an eventual lead magnet for wider use.

### Priority 1 — Structure Drawing UI

The `structures` table and TypeScript types are complete. What's missing is the drawing tool and SVG rendering. Structures are the physical canvas everything else sits on — patio, shed, raised beds, and fence are all present in the real yard and need to be mapped first before plant placement has meaningful spatial context.

**Raised beds as zones:** Probable answer from Kira — raised beds should be treated as first-class zones with their own plant lists, not just shapes on the map. This means a raised bed `structure` needs a way to query "what's planted in this bed" rather than relying purely on spatial overlap of `anchor_row/anchor_col`.

**DB addition for zones:**
```sql
ALTER TABLE plantings
  ADD COLUMN zone_structure_id UUID REFERENCES structures(id) ON DELETE SET NULL;
```
When a planting is placed inside a structure with `type = 'raised_bed'` (or any zone-eligible type), set `zone_structure_id` so the planting can be queried/grouped by bed directly, independent of recomputing spatial overlap on every render. Structure detail view would then show "Plants in this bed" as a first-class list.

**DB:** Migration needed for `zone_structure_id` column (above); rest of `structures` table is unchanged.

**UI work:**
- Toolbar mode: `select | draw-rect | draw-polygon | draw-polyline | draw-point`
- Start with rectangle mode — covers patio, shed, deck, raised beds (most common cases)
- Rectangle mode: click anchor → drag to size → release to save
- Polygon/polyline mode: click to add points → double-click to close (paths, fences, irregular beds)
- Point mode: click to place (fountain, birdbath, fire pit)
- Selection handles: click placed structure to show resize/rotate/delete controls
- Structure palette: pick type → sets default color/pattern hint

**Rendering (`YardGrid.tsx`):**
- Render area structures (patio, deck, path, pond) below plantings
- Render point structures (shed, fountain, fire pit) above plantings
- Rectangle: filled SVG `<rect>` with optional pattern fill (hatch, crosshatch, solid)
- Polygon/polyline: SVG `<polygon>` / `<polyline>`
- Point: icon centered at anchor cell (reuse `feature_category_icons` lookup)
- Z-ordering: render by `z_index` ascending

**Precision:** Users expect accurate-to-the-foot placement. The grid's `cell_size_inches` field supports this — ensure the structure drawing UI shows real-world dimensions as the user drags (e.g., "12 ft × 8 ft").

**Code note:** `YardGrid.tsx` is already 550+ lines. Extract structure rendering into `StructureLayer.tsx` rather than adding to the monolith. Do this refactor as part of this feature, not after.

---

### Priority 2 — Richer Plant Visuals

The current plant icons (small Lucide symbols) are functional but not visually rich enough to support combination planning — the primary hook for Kira. The map needs to feel like a garden, not a diagram.

**Chosen approach: Illustrated Flat** — each plant gets a distinct, recognizable SVG shape (daisy petals, upright spikes, grass blades, etc.) with a crisp footprint circle that is precisely to scale. Stylized but unambiguous about spatial extent.

**Why not watercolor:** Soft blurred edges look beautiful but make it impossible to answer "does this coneflower overlap the path?" — the footprint boundary disappears. Precision is a stated requirement.

**Presentation mode (watercolor render):** The same data can be rendered with blur/displacement filters in a "share / present" mode — stunning for the seasonal timelapse view (see Priority 5). Planning uses illustrated flat; presenting uses watercolor. Toggle, not a choice.

**Plant notes and photos (Kira):** Kira wants to add her own notes per plant. Photo support should also be included — user-uploaded photos per planting (not per plant species), stored in Supabase Storage, displayed in the detail panel and optionally as a thumbnail on the map.

**DB additions needed:**
```sql
-- Photo attachments per planting
CREATE TABLE planting_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id UUID NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,   -- Supabase Storage object key
  caption     TEXT,
  taken_at    DATE,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Illustrated SVG icon plan:**
- One custom SVG shape per taxonomic type (Tree, Shrub, Perennial, Grass, Vine, etc.)
- Seasonal color variation: fill shifts to `flower_color` during bloom, `deciduous_fall_color` in fall, desaturated in dormancy
- Bloom halo: soft colored ring expands outward during peak bloom (visible even at small sizes)
- Footprint circle: crisp, dashed, to-scale — always visible in planning mode

**Implementation note:** Icons stored as inline SVG path strings in `plantIcons.ts`, keyed by `taxonomic_type`. No external assets; no CDN dependency.

---

### Priority 3 — Sharing / Co-Editor Access

Kira needs full edit access, not viewer access. She'll be using the app on her phone as a co-creator. The current email whitelist approach works as a temporary gate but isn't a sharing model.

**DB migration:**
```sql
CREATE TABLE yard_members (
  yard_id    UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer',  -- 'owner' | 'collaborator' | 'viewer'
  invited_by UUID REFERENCES auth.users(id),
  joined_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (yard_id, user_id)
);
```

**RLS update:** Replace `user_id = auth.uid()` on yards with membership check:
```sql
CREATE POLICY "yard members can read"
  ON yards FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (SELECT yard_id FROM yard_members WHERE user_id = auth.uid())
  );
```

**UI work:**
- Yard settings panel: "Share" button → enter email → create invite
- Invite flow: email sent via Supabase (or Resend) with magic link → on accept, insert `yard_members` row
- Collaborators see shared yard in their switcher; role gates write access (collaborator = full edit, viewer = read-only)

**Realtime sync:** Plantings and grid_cells would need realtime subscriptions (currently structures-only). Add `postgres_changes` channels in `usePlantings`, `useElevation`, `useShade`, `useWaterFlow`.

---

### Priority 4 — Mobile Layout

Kira will primarily use this on her phone. The current layout is desktop-first and not usable for touch-based grid interaction.

**Problems to solve:**
1. 18px cell size is too small for finger tap accuracy
2. Side panels (PlantDetailPanel, PlantSearch) take up width needed for the grid on narrow screens
3. Palettes (elevation, shade, water flow) are small tap targets

**Approach:**
- Add a `useMobile` hook (`ResizeObserver` on root) to derive `isMobile`
- Dynamic `CELL_PX`: `isMobile ? 28 : 18` (or fit to available viewport / yard width)
- Replace side panels with **bottom sheets** on mobile — slide up from bottom, full width, partial height
- Larger tap targets in palettes on mobile (bigger button padding via Tailwind responsive prefixes)
- Simplified toolbar on mobile: hide overlay toggles (elevation, water, shade) behind a "layers" menu — they're planning tools, not primary mobile actions
- Structures drawing on mobile: tap-to-place is fine for rectangles; polygon drawing may need a dedicated mobile interaction pattern

---

### Priority 5 — Seasonal Timelapse + Bloom View

**Confirmed direction:** Kira's primary reason to open the app is to plan what's new — not to check current state. So the main planning surface should stay focused on "add / move / preview a change," while a separate **timelapse view** handles the "see how it all comes together over the year" need — primarily for sharing with others.

**Timelapse view (sharing-oriented):**
- Animated playback that steps through months, rendering the yard in **watercolor presentation mode** (see Priority 2)
- Auto-advances or scrubbable via the existing month slider, repurposed for animation
- Designed to be shown to someone else (the "show this to a neighbor" scenario from discovery) — a polished, non-editable view
- Could double as a shareable link/export later (video export or animated GIF) once the visual style is locked in

**Bloom calendar (planning-oriented, lower priority):**
- A month-by-month color summary remains useful but is secondary to the timelapse — fold into the same view rather than building separately
- Show bloom windows on a timeline only if it doesn't compete for attention with the "plan what's new" primary flow

**Design implication:** Keep the day-to-day editing UI lean and change-focused. The timelapse/presentation view is a distinct mode, not bolted onto the main grid.

---

### Priority 6 — GIS / Yard Import

For wider release, manual yard creation (enter width/height in feet) won't be enough. Users need a way to import a real property boundary.

**Options:**
- **GeoJSON upload** — user exports from a GIS tool (e.g., Google Earth, county parcel viewer) and uploads
- **Parcel lookup by address** — query a public parcel API to pull property boundary automatically
- **Manual trace over satellite** — user places the app on top of a satellite image and traces their yard boundary

**Near-term:** No action needed. The `yards` table is simple enough to extend with a `boundary_geojson` column when the time comes.

**Longer-term:** If this becomes a lead magnet or SaaS product, yard import UX will be a key onboarding moment — worth designing carefully when the time comes.

---

### Priority 7 — State Management Refactor

`GardenApp.tsx` holds all cross-cutting state (active yard, selected plant, current month, overlay toggles) and passes it down as props. This works now but will get painful as structures UI, mobile layouts, and sharing add more state.

**Recommendation:** Extract a lightweight React Context (or Zustand store) before or during the structures UI build, since that feature adds draw mode + selected structure to the same pile.

**What to extract:**
```typescript
// GardenContext
{
  activeYard: Yard | null
  setActiveYard: (yard: Yard) => void
  currentMonth: number
  setCurrentMonth: (m: number) => void
  overlays: { elevation: bool, water: bool, shade: bool }
  toggleOverlay: (key: string) => void
  selectedPlanting: Planting | null
  setSelectedPlanting: (p: Planting | null) => void
  drawMode: DrawMode
  selectedStructure: Structure | null
}
```

`YardGrid.tsx` should also be split: extract `StructureLayer.tsx`, `PlantingLayer.tsx`, and `OverlayLayer.tsx` to keep each file under ~200 lines.

---

## Decisions — Working Assumptions Pending Kira's Confirmation

Zach's best guesses as of June 2026, used to unblock planning. Treat these as provisional — confirm with Kira before final implementation, especially #4 since it determines the visual asset approach.

1. **Primary hook: planning what's new.** She opens the app to plan changes, not to check current bloom state. → Keeps the main editing UI change-focused; bloom/timelapse is a separate mode (Priority 5).
2. **Notes: yes, and photos too.** → Added `planting_photos` table to Priority 2; notes already supported on `plantings.notes`.
3. **Raised beds: probably separate zones.** → Added `zone_structure_id` on `plantings` (Priority 1) so beds can have first-class plant lists.
4. **Aesthetic: Illustrated Flat for planning, watercolor for presentation. Confirmed.** Illustrated flat keeps footprints crisp and to-scale for day-to-day planning; watercolor is a separate render mode used for presenting/sharing (e.g., the timelapse view in Priority 5). Implementation can proceed on this basis.
5. **Sharing: wants a timelapse view.** → Priority 5 redefined around an animated, presentation-mode timelapse rather than a static bloom calendar.

**Still fully open** (not guessed):
- Would she ever want to export/share a timelapse externally (video, link, GIF)?
- Any specific people beyond family she'd want to show this to, and what they should be able to do (view-only vs. edit)?

---

## Open Items

- `years_to_maturity` lookup values (Slow=7, Medium=4, Rapid=2) are placeholders — revisit with domain input
- Fall color date window uses a hardcoded Oct–Nov window; may need `fall_color_start_md`/`fall_color_end_md` on `plants` if precision matters
- `yard_features` table is legacy and unused — can be dropped in a future migration once structures UI is live
- Structure drawing: rectangle mode ships first; polygon/polyline (paths, fences) in a follow-up
- Plant compatibility / companion planting is a long-horizon feature — no schema work needed yet
- If app opens to wider users: registration flow, onboarding, and GIS import become critical path
