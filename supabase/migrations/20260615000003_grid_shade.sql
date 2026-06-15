-- Sunlight/shade overlay data per cell
-- Values: full_sun | shade_1 | shade_1_am | shade_1_pm
--                   | shade_2 | shade_2_am | shade_2_pm
--                   | shade_3 | shade_3_am | shade_3_pm
--                   | shade_4
ALTER TABLE grid_cells ADD COLUMN shade_level TEXT;
