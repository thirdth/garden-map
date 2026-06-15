-- Garden Mapper app tables
-- yards, grid_cells, plantings, yard features, category icons

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE water_flow_dir AS ENUM (
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'NONE', 'POOLING'
);

CREATE TYPE render_mode AS ENUM ('point', 'area');

-- ── Yards ─────────────────────────────────────────────────────────────────────

CREATE TABLE yards (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  width_cells      INT     NOT NULL,
  height_cells     INT     NOT NULL,
  cell_size_inches NUMERIC NOT NULL DEFAULT 6
);

-- ── Grid Cells ────────────────────────────────────────────────────────────────
-- Pre-populated for the full yard grid on creation.

CREATE TABLE grid_cells (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id              UUID          NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  row                  INT           NOT NULL,
  col                  INT           NOT NULL,
  elevation            SMALLINT,
  water_flow_direction water_flow_dir,
  UNIQUE (yard_id, row, col)
);

-- ── Plant Category Icons ───────────────────────────────────────────────────────
-- icon_reference stores a Lucide icon name (e.g. "Tree", "Flower").
-- Frontend resolves to React component via lookup map.

CREATE TABLE plant_category_icons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomic_type TEXT NOT NULL UNIQUE,
  icon_reference TEXT NOT NULL
);

INSERT INTO plant_category_icons (taxonomic_type, icon_reference) VALUES
  ('Tree',                  'Tree'),
  ('Shrub',                 'Flower2'),
  ('Herbaceous Perennial',  'Flower'),
  ('Annual',                'Sun'),
  ('Biennial',              'Sun'),
  ('Vine',                  'Grape'),
  ('Bulb',                  'Leaf'),
  ('Fern',                  'Leaf'),
  ('Ground Cover',          'Layers'),
  ('Ornamental Grass',      'Wind'),
  ('Houseplant',            'Sprout'),
  ('Epiphyte',              'Sprout');

-- ── Plantings ─────────────────────────────────────────────────────────────────
-- Active = removed_date IS NULL. Historical rows remain for past-state views.

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

-- ── Feature Category Icons ────────────────────────────────────────────────────

CREATE TABLE feature_category_icons (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_type   TEXT        NOT NULL UNIQUE,
  render_mode    render_mode NOT NULL,
  icon_reference TEXT        NOT NULL
);

INSERT INTO feature_category_icons (feature_type, render_mode, icon_reference) VALUES
  ('shed',         'point', 'Home'),
  ('patio',        'area',  'Square'),
  ('deck',         'area',  'Square'),
  ('fence',        'area',  'Fence'),
  ('table',        'point', 'Table'),
  ('fire_pit',     'point', 'Flame'),
  ('path',         'area',  'Route'),
  ('pond',         'area',  'Waves'),
  ('birdbath',     'point', 'Bird'),
  ('planter_box',  'area',  'Sprout');

-- ── Yard Features ─────────────────────────────────────────────────────────────

CREATE TABLE yard_features (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX ON yards (user_id);
CREATE INDEX ON grid_cells (yard_id);
CREATE INDEX ON plantings (yard_id);
CREATE INDEX ON plantings (plant_id);
CREATE INDEX ON plantings (removed_date);
CREATE INDEX ON yard_features (yard_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE yards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_cells     ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_features  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own yards"
  ON yards FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users manage own grid_cells"
  ON grid_cells FOR ALL
  USING (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()))
  WITH CHECK (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()));

CREATE POLICY "users manage own plantings"
  ON plantings FOR ALL
  USING (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()))
  WITH CHECK (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()));

CREATE POLICY "users manage own yard_features"
  ON yard_features FOR ALL
  USING (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()))
  WITH CHECK (yard_id IN (SELECT id FROM yards WHERE user_id = auth.uid()));

-- plant_category_icons and feature_category_icons are public reference data
CREATE POLICY "public read plant_category_icons"
  ON plant_category_icons FOR SELECT USING (true);

CREATE POLICY "public read feature_category_icons"
  ON feature_category_icons FOR SELECT USING (true);

ALTER TABLE plant_category_icons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_category_icons ENABLE ROW LEVEL SECURITY;
