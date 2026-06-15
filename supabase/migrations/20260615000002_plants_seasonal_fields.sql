-- Seasonal and calendar fields for plant rendering
-- Additive: flower_color, bloom_seasons, bloom_window_text, deciduous_fall_color already exist

ALTER TABLE plants
  ADD COLUMN default_icon       TEXT,
  ADD COLUMN bloom_start_md     TEXT,    -- MM-DD, for calendar computation
  ADD COLUMN bloom_end_md       TEXT,    -- MM-DD, for calendar computation
  ADD COLUMN foliage_color      TEXT,    -- normal/non-blooming render color
  ADD COLUMN dieback_start_md   TEXT,    -- MM-DD; herbaceous perennials only
  ADD COLUMN regrowth_start_md  TEXT;    -- MM-DD; herbaceous perennials only
