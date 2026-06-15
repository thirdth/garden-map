-- All plant reference tables are public read-only (no auth required)
CREATE POLICY "public read plants"
  ON plants FOR SELECT USING (true);

CREATE POLICY "public read plant_common_names"
  ON plant_common_names FOR SELECT USING (true);

CREATE POLICY "public read plant_synonyms"
  ON plant_synonyms FOR SELECT USING (true);

CREATE POLICY "public read plant_state_distribution"
  ON plant_state_distribution FOR SELECT USING (true);

CREATE POLICY "public read plant_relationships"
  ON plant_relationships FOR SELECT USING (true);

CREATE POLICY "public read plant_herbaceous_details"
  ON plant_herbaceous_details FOR SELECT USING (true);

CREATE POLICY "public read plant_woody_details"
  ON plant_woody_details FOR SELECT USING (true);

CREATE POLICY "public read plant_pronunciations"
  ON plant_pronunciations FOR SELECT USING (true);

CREATE POLICY "public read plant_pest_disease"
  ON plant_pest_disease FOR SELECT USING (true);

CREATE POLICY "public read plant_media"
  ON plant_media FOR SELECT USING (true);

CREATE POLICY "public read ecoregions"
  ON ecoregions FOR SELECT USING (true);

CREATE POLICY "public read plant_ecoregions"
  ON plant_ecoregions FOR SELECT USING (true);
