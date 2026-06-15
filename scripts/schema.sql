-- Garden Map — Plant Database Schema
-- Target: Supabase (PostgreSQL)
-- Based on: docs/plant-attribute-review.md (Resolved Decisions applied)

-- ── Reference Data ─────────────────────────────────────────────────────────

CREATE TABLE ecoregions (
  id   SMALLINT PRIMARY KEY,
  name TEXT     NOT NULL
);

INSERT INTO ecoregions (id, name) VALUES
  (1, 'Blue Ridge'),
  (2, 'Ridge and Valley'),
  (3, 'Southwestern Appalachians'),
  (4, 'Central Appalachians'),
  (5, 'Southeastern Plains'),
  (6, 'Interior Plateau'),
  (7, 'Mississippi Alluvial Plain'),
  (8, 'Mississippi Valley Loess Plains');

-- ── Core Plant Table ───────────────────────────────────────────────────────

CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity / Naming
  genus           TEXT NOT NULL,
  species         TEXT NOT NULL,
  cultivar        TEXT,                         -- null for straight species
  family          TEXT,

  -- Description
  description              TEXT,
  insect_disease_problems  TEXT,
  particularly_resistant_to TEXT[],

  -- Origin / Distribution
  country_of_origin        TEXT[],
  usda_hardiness_zone_min  SMALLINT,
  usda_hardiness_zone_max  SMALLINT,

  -- Whole Plant Traits
  -- (resolved: Plant Type → taxonomic_type + ecological_tags)
  life_cycle       TEXT,                        -- Woody/Perennial/Annual/Biennial
  taxonomic_type   TEXT,                        -- Tree/Shrub/Herbaceous Perennial/Vine/Annual
  ecological_tags  TEXT[],                      -- Native Plant/Wildflower/etc.
  habit_form       TEXT[],                      -- Erect/Rounded/Spreading/Multi-stemmed/etc.
  growth_rate      TEXT,                        -- Slow/Medium/Rapid
  maintenance      TEXT,                        -- Low/Medium/High
  texture          TEXT,                        -- Fine/Medium/Coarse

  -- Dimensions (in feet)
  height_min_ft   NUMERIC(5,2),
  height_max_ft   NUMERIC(5,2),
  spread_min_ft   NUMERIC(5,2),
  spread_max_ft   NUMERIC(5,2),
  spacing_min_ft  NUMERIC(5,2),
  spacing_max_ft  NUMERIC(5,2),

  -- Cultural Conditions
  light         TEXT[],                         -- Full Sun/Partial Shade/Shade
  soil_texture  TEXT[],                         -- Clay/Loam/Sand/High Organic Matter
  soil_ph       TEXT[],                         -- Acid/Neutral/Alkaline
  soil_drainage TEXT[],                         -- Good Drainage/Moist/Occasionally Wet
  watering_need TEXT,                           -- Frequent/Average/Minimum/None

  -- Flowers / Bloom  (resolved: dual bloom format)
  flower_color        TEXT[],
  bloom_seasons       TEXT[],                   -- Spring/Summer/Fall/Winter
  bloom_window_text   TEXT,                     -- e.g. "late March – early May"
  flower_inflorescence TEXT,
  flower_shape        TEXT,
  flower_size_min_in  NUMERIC(5,2),
  flower_size_max_in  NUMERIC(5,2),
  flower_petals_min   SMALLINT,
  flower_petals_max   SMALLINT,
  flower_value        TEXT[],                   -- Showy/Fragrant/Good Cut/Good Dried
  flower_description  TEXT,

  -- Fruit / Seed
  fruit_color           TEXT[],
  fruit_type            TEXT,                   -- Achene/Follicle/Aggregate/etc.
  fruit_length_min_in   NUMERIC(5,2),
  fruit_length_max_in   NUMERIC(5,2),
  fruit_width_min_in    NUMERIC(5,2),
  fruit_width_max_in    NUMERIC(5,2),
  fruit_value           TEXT[],
  fruit_harvest_time    TEXT,
  fruit_description     TEXT,

  -- Leaves
  leaf_color          TEXT[],
  leaf_feel           TEXT[],                   -- Glossy/Leathery/Rough
  leaf_type           TEXT,                     -- Simple/Compound
  leaf_arrangement    TEXT,                     -- Alternate/Opposite
  leaf_shape          TEXT,
  leaf_margin         TEXT[],                   -- Entire/Dentate
  leaf_length_min_in  NUMERIC(5,2),
  leaf_length_max_in  NUMERIC(5,2),
  leaf_width_min_in   NUMERIC(5,2),
  leaf_width_max_in   NUMERIC(5,2),
  hairs_present       BOOLEAN,
  deciduous_fall_color TEXT[],
  leaf_value          TEXT[],
  leaf_description    TEXT,

  -- Safety / Edibility
  poisonous_to_humans BOOLEAN,
  poisonous_to_pets   BOOLEAN,
  medicinal           BOOLEAN,
  edible_fruit        BOOLEAN,
  edible_leaf         BOOLEAN,

  -- Wildlife / Ecology
  wildlife_value  TEXT,
  attracts        TEXT[],                       -- Butterflies/Bees/Hummingbirds/Birds/etc.
  play_value      TEXT[],
  fire_risk       TEXT,                         -- Low/Medium/High

  -- Landscape Use
  landscape_location       TEXT[],
  landscape_theme          TEXT[],
  design_feature           TEXT[],
  resistance_to_challenges TEXT[],              -- Deer/Drought/Salt/Wet Soil/Pollution/Fire

  -- Stem (present on all plant types)
  stem_color        TEXT[],
  stem_form         TEXT,
  stem_surface      TEXT,
  stem_is_aromatic  BOOLEAN,
  stem_description  TEXT,

  -- Source tracking
  nc_extension_slug TEXT UNIQUE,
  usda_symbol       TEXT UNIQUE,
  trefle_id         INTEGER UNIQUE,
  perenual_id       INTEGER UNIQUE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Common Names ───────────────────────────────────────────────────────────

CREATE TABLE plant_common_names (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  name     TEXT    NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Taxonomic Synonyms ("Previously known as") ─────────────────────────────

CREATE TABLE plant_synonyms (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  synonym  TEXT NOT NULL
);

-- ── Pronunciation ──────────────────────────────────────────────────────────

CREATE TABLE plant_pronunciations (
  plant_id         UUID PRIMARY KEY REFERENCES plants(id) ON DELETE CASCADE,
  phonetic_spelling TEXT,
  audio_url        TEXT
);

-- ── State / Province Distribution ─────────────────────────────────────────

CREATE TABLE plant_state_distribution (
  plant_id   UUID    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  state_code CHAR(2) NOT NULL,
  PRIMARY KEY (plant_id, state_code)
);

-- ── TN Level III Ecoregion Membership ─────────────────────────────────────

CREATE TABLE plant_ecoregions (
  plant_id     UUID     NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  ecoregion_id SMALLINT NOT NULL REFERENCES ecoregions(id),
  PRIMARY KEY (plant_id, ecoregion_id)
);

-- ── Woody-Plant-Only Details ───────────────────────────────────────────────
-- Populated iff taxonomic_type IN ('Tree', 'Shrub')

CREATE TABLE plant_woody_details (
  plant_id                UUID PRIMARY KEY REFERENCES plants(id) ON DELETE CASCADE,
  woody_leaf_characteristics TEXT,              -- Deciduous/Evergreen/Semi-evergreen
  bark_color              TEXT[],
  bark_surface            TEXT,
  bark_description        TEXT
);

-- ── Herbaceous-Only Details ────────────────────────────────────────────────
-- Populated iff taxonomic_type IN ('Herbaceous Perennial', 'Annual', 'Biennial')

CREATE TABLE plant_herbaceous_details (
  plant_id             UUID  PRIMARY KEY REFERENCES plants(id) ON DELETE CASCADE,
  propagation_strategy TEXT[]
);

-- ── Inter-Plant Relationships ──────────────────────────────────────────────

CREATE TABLE plant_relationships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id         UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  related_plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  related_name_text TEXT,                       -- fallback when plant not yet in DB
  relationship_type TEXT NOT NULL,
  -- 'confused_with' | 'similar_to' | 'fills_niche' | 'native_alternative_for'
  CONSTRAINT chk_relationship_type CHECK (
    relationship_type IN ('confused_with', 'similar_to', 'fills_niche', 'native_alternative_for')
  )
);

-- ── Pest / Disease Associations ────────────────────────────────────────────

CREATE TABLE plant_pest_disease (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id   UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,                     -- 'pest' or 'disease'
  name       TEXT NOT NULL,
  link_url   TEXT,
  CONSTRAINT chk_entry_type CHECK (entry_type IN ('pest', 'disease'))
);

-- ── Media ──────────────────────────────────────────────────────────────────

CREATE TABLE plant_media (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  media_type   TEXT    NOT NULL,                -- 'image' or 'audio'
  original_url TEXT,
  regular_url  TEXT,
  medium_url   TEXT,
  small_url    TEXT,
  thumbnail_url TEXT,
  caption      TEXT,
  photographer TEXT,
  license_id   INTEGER,
  license_name TEXT,
  license_url  TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  source       TEXT,                            -- 'perenual' | 'manual' | etc.
  CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'audio'))
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX ON plants (genus, species);
CREATE INDEX ON plants (nc_extension_slug);
CREATE INDEX ON plants (usda_symbol);
CREATE INDEX ON plants (perenual_id);
CREATE INDEX ON plants USING GIN (ecological_tags);
CREATE INDEX ON plants USING GIN (attracts);
CREATE INDEX ON plants USING GIN (bloom_seasons);
CREATE INDEX ON plants USING GIN (resistance_to_challenges);
CREATE INDEX ON plant_common_names (plant_id);
CREATE INDEX ON plant_ecoregions (plant_id);
CREATE INDEX ON plant_state_distribution (plant_id);

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER plants_updated_at
  BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
