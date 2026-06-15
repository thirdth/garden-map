# Garden Mapper — App Build Plan

This document captures the technical decisions, architecture, and build sequence for the Garden Mapper frontend. The plant reference database (NC Extension import, schema, scripts) is already built and out of scope here.

---

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Vite + React + TypeScript | No SSR needed; fast dev server; SVG grid works naturally in React |
| Styling | Tailwind CSS | Utility-first, good for dense UI |
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

**Yard features:**

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

---

## Repository Layout

```
garden-map/
├── app/                        ← Vite + React frontend (new)
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── supabase.ts     ← supabase-js client
│   │   └── types/              ← generated from Supabase schema
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── docs/
├── scripts/                    ← data pipeline scripts
├── supabase/
│   └── migrations/
└── .gitignore
```

---

## Infrastructure

- Same Supabase project as the plant database (`damubjvzwnzhjnbdmngs`)
- All schema changes go through numbered migration files in `supabase/migrations/`
- Deploy via `supabase db push` — no manual dashboard edits
- Vercel project linked to the GitHub repo; auto-deploys on push to `main`
- Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) injected by Vercel's native Supabase integration

---

## Auth

- **Provider**: Google OAuth via Supabase Auth
- **Sign-in flow**: Redirect to Google → return to app → session stored in supabase-js
- **User scope**: Each user owns their own yards and plantings. Design supports multiple users (family, eventually other gardeners) without migration.
- **`plants` table**: Public read-only — reference data, no RLS needed.
- **App tables**: RLS enabled on `yards`, `plantings`, `yard_features`. Policies scope all reads/writes to `auth.uid()`.

---

## Database Migrations (to write)

### Migration 1 — App tables

**`yards`**
```sql
CREATE TABLE yards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  width_cells    INT  NOT NULL,
  height_cells   INT  NOT NULL,
  cell_size_inches NUMERIC NOT NULL DEFAULT 6
);
```

**`grid_cells`**
```sql
CREATE TYPE water_flow_dir AS ENUM ('N','NE','E','SE','S','SW','W','NW','NONE','POOLING');

CREATE TABLE grid_cells (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id              UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  row                  INT  NOT NULL,
  col                  INT  NOT NULL,
  elevation            SMALLINT,
  water_flow_direction water_flow_dir,
  UNIQUE (yard_id, row, col)
);
```
> Pre-populate full grid on yard creation (simpler queries than lazy creation).

**`plant_category_icons`**
```sql
CREATE TABLE plant_category_icons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomic_type TEXT NOT NULL UNIQUE,
  icon_reference TEXT NOT NULL
);
```

**`plantings`**
```sql
CREATE TABLE plantings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES plants(id),
  yard_id        UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  anchor_row     INT  NOT NULL,
  anchor_col     INT  NOT NULL,
  custom_label   TEXT,
  planted_date   DATE,
  removed_date   DATE,
  removal_reason TEXT,
  notes          TEXT
);
-- Active plantings: removed_date IS NULL
-- Historical plantings remain queryable for past-state views
```

**`feature_category_icons`**
```sql
CREATE TYPE render_mode AS ENUM ('point', 'area');

CREATE TABLE feature_category_icons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_type   TEXT        NOT NULL UNIQUE,
  render_mode    render_mode NOT NULL,
  icon_reference TEXT        NOT NULL
);
```

**`yard_features`**
```sql
CREATE TABLE yard_features (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id          UUID        NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  feature_type     TEXT        NOT NULL,
  render_mode      render_mode NOT NULL,
  anchor_row       INT         NOT NULL,
  anchor_col       INT         NOT NULL,
  width_cells      INT,
  height_cells     INT,
  rotation_degrees INT         NOT NULL DEFAULT 0,
  label            TEXT,
  notes            TEXT,
  z_layer          INT
);
```

**RLS policies** (on `yards`, `plantings`, `yard_features`):
```sql
ALTER TABLE yards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_cells   ENABLE ROW LEVEL SECURITY;

-- Example (repeat pattern for each table):
CREATE POLICY "users see own yards"
  ON yards FOR ALL
  USING (user_id = auth.uid());

-- plantings/grid_cells/yard_features scope through yard ownership:
CREATE POLICY "users see own plantings"
  ON plantings FOR ALL
  USING (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()));
```

### Migration 2 — `plants` table additions (seasonal/calendar fields)

```sql
ALTER TABLE plants
  ADD COLUMN default_icon      TEXT,
  ADD COLUMN bloom_start_md    TEXT,   -- MM-DD
  ADD COLUMN bloom_end_md      TEXT,   -- MM-DD
  ADD COLUMN foliage_color     TEXT,
  ADD COLUMN dieback_start_md  TEXT,   -- MM-DD; herbaceous only
  ADD COLUMN regrowth_start_md TEXT;   -- MM-DD; herbaceous only
```
> `flower_color`, `bloom_seasons`, `bloom_window_text`, and `deciduous_fall_color` already exist — these new fields are additive.

---

## Rendering Logic

### Layer order (back → front)
1. Grid base (cell borders)
2. Elevation overlay (toggle) — color fill per cell from `elevation`
3. Area features (patio, deck, path, pond) — filled/textured polygons with rotation
4. Plantings — icons with seasonal state
5. Point features (shed, table, fire pit) — icons at anchor
6. Water flow overlay (toggle) — directional arrows per cell

### Plant seasonal state (given selected date)
```
if dieback_start_md/regrowth_start_md set AND date in dormancy range
  → render dimmed, ~35% size
else if date in bloom_start_md–bloom_end_md
  → render in flower_color
else if woody deciduous AND date in fall window
  → render in deciduous_fall_color
else
  → render in foliage_color
```

### Size scaling
```
years_to_maturity = { Slow: 7, Medium: 4, Rapid: 2 }
size_fraction = min(1.0, years_since_planted / years_to_maturity)
footprint_radius_cells = (spread_max_ft * 12 * size_fraction) / cell_size_inches
```
Footprints are visual only — overlapping is allowed (tree canopy over groundcover).

---

## Build Order

Following the sequence in the spec:

| Step | Work |
|---|---|
| 0 | Migrations (app tables + plants additions), RLS policies, Google OAuth config in Supabase |
| 1 | Vite + React + TS scaffold in `/app`; supabase-js client wired; Vercel project created and linked |
| 2 | Yard switcher UI + SVG grid render (no plants yet); pre-populate grid_cells on yard creation |
| 3 | Elevation overlay toggle |
| 4 | Water flow overlay toggle |
| 5 | Plantings — category icon render, anchor placement on grid |
| 6 | Seasonal/calendar rendering — date slider, bloom/dormancy/fall color state |
| 7 | Growth size scaling |
| 8 | Yard features — point icons and area polygons with rotation |
| 9 | Zoom/pan polish (viewBox scaling, drag pan) |
| 10 | Click-to-edit detail views; planting history/removal UI |

---

## Open Items

- `years_to_maturity` lookup values (Slow=7, Medium=4, Rapid=2) are placeholders — revisit with domain input
- Fall color date window: currently uses an informal seasonal window; may need `fall_color_start_md`/`fall_color_end_md` fields on `plants` if precision matters
- Icon assets: using Lucide React for v1 (see stack section); can be upgraded to custom illustrated icons later by updating `icon_reference` values in the DB
- Decide whether other gardeners can ever create accounts, or this stays personal; RLS is already designed for multi-user, but registration/invite flow isn't scoped for v1
