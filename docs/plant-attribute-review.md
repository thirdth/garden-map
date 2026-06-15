# Plant Database Attributes — For Review

Source pages reviewed:
- *Magnolia virginiana* (tree/shrub) — https://plants.ces.ncsu.edu/plants/magnolia-virginiana/
- *Echinacea pallida* (herbaceous perennial) — https://plants.ces.ncsu.edu/plants/echinacea-pallida/
- *Fothergilla 'Mount Airy'* (shrub cultivar) — https://plants.ces.ncsu.edu/plants/fothergilla-mount-airy/

This is a raw inventory of every attribute found on these pages, grouped by category. Goal: react to this list — mark anything as **Keep**, **Drop**, **Combine**, or **Split**, and flag anything missing. We'll use your feedback to design the actual database schema.

---

## 1. Identity / Naming
- Genus
- Species
- Cultivar / Variety name
- Common name(s) — multiple
- Previously known as (synonyms)
- Family
- Phonetic spelling / pronunciation audio

## 2. Description
- Free-text description (habit, history, uses, "quick ID hints")
- Insects / Diseases / Other problems (free text)
- Particularly Resistant To (insects, diseases, other)

## 3. Origin / Distribution
- Country or Region of Origin
- Distribution (list of states/provinces)
- NC Region (Coastal / Mountains / Piedmont) — *will need a TN-equivalent or general regional field*
- USDA Plant Hardiness Zone (range)

## 4. Whole Plant Traits
- Life Cycle (Woody / Perennial / Annual / Biennial)
- Plant Type (Native Plant, Tree, Shrub, Perennial, Herbaceous Perennial, Wildflower — multi-select)
- Habit/Form (Erect, Rounded, Spreading, Multi-stemmed, Columnar, Vase, etc.)
- Growth Rate (Slow / Medium / Rapid)
- Maintenance (Low / Medium / High)
- Texture (Fine / Medium / Coarse)
- Woody Plant Leaf Characteristics (Deciduous / Evergreen / Semi-evergreen) — *woody plants only*
- Recommended Propagation Strategy (Division, Seed, etc.) — *only appeared on the perennial*

## 5. Dimensions
- Height (range)
- Width / Spread (range)
- Available Space to Plant (spacing range)

## 6. Cultural Conditions (sun / water / soil)
- Light (Full Sun / Partial Shade / Shade — multi-select)
- Soil Texture (Clay, Loam, Sand, High Organic Matter — multi-select)
- Soil pH (Acid / Neutral / Alkaline ranges)
- Soil Drainage (Good Drainage, Moist, Occasionally Wet — multi-select) — *this is the wet/dry signal*

## 7. Flowers / Bloom Data
- Flower Color (multi-select)
- Flower Bloom Time (Spring / Summer / Fall / Winter — season buckets, not exact months)
- Flower Inflorescence (Solitary, etc.)
- Flower Shape
- Flower Size (range)
- Flower Petals (count range)
- Flower Value to Gardener (Showy, Fragrant, Good Cut, Good Dried — multi-select)
- Flower Description (free text)

## 8. Fruit / Seed
- Fruit Color
- Fruit Type (Achene, Follicle, Aggregate, etc.)
- Fruit Length / Width (range)
- Fruit Value to Gardener (Showy, Good Cut, Good Dried)
- Display / Harvest Time
- Fruit Description (free text)

## 9. Leaves
- Leaf Color
- Leaf Feel (Glossy, Leathery, Rough)
- Leaf Type (Simple / Compound)
- Leaf Arrangement (Alternate / Opposite)
- Leaf Shape
- Leaf Margin (Entire / Dentate)
- Leaf Length / Width (range)
- Hairs Present (Y/N)
- Deciduous Leaf Fall Color
- Leaf Value to Gardener
- Leaf Description (free text)

## 10. Bark / Stem (mostly woody plants)
- Bark Color
- Bark Surface/Attachment (Smooth, etc.)
- Bark Description (free text)
- Stem Color
- Stem Form (Straight, etc.)
- Stem Surface
- Stem Is Aromatic (Y/N)
- Stem Description (free text)

## 11. Wildlife / Ecology
- Wildlife Value (free text — host plant info, food sources)
- Attracts (Butterflies, Bees, Hummingbirds, Birds, Small Mammals, Pollinators — multi-select)
- Play Value (Attractive Flowers, Fragrance, Easy to Grow, Defines Paths, Wildlife Food Source/Larval Host — multi-select)
- Fire Risk Rating (Low / Medium / High flammability)

## 12. Landscape Use
- Landscape Location (Lawn, Patio, Pond, Woodland, Container, Meadow, etc.)
- Landscape Theme (Native Garden, Pollinator Garden, Cottage Garden, Rain Garden, etc.)
- Design Feature (Specimen, Border, Hedge, Mass Planting, Accent, etc.)
- Resistance to Challenges (Deer, Drought, Salt, Wet Soil, Pollution, Fire — multi-select)

## 13. Relationships to Other Plants
- "Often confused with" (similar species)
- "Similar but less problematic" alternatives
- "Plants that fill a similar niche"
- "Native alternative(s) for" (cultivar → native substitute)
- Common insect problems (linked pest pages)
- Common disease problems (linked disease pages)

## 14. Media
- Images (with captions, photographer, license)
- Audio pronunciation file

---

## Resolved Decisions

1. **Plant Type split into two fields.**
   - `taxonomic_type` — Tree, Shrub, Herbaceous Perennial, Vine, Annual, etc.
   - `ecological_tags` — Native Plant, Wildflower, etc. (multi-select)

2. **Woody-only section — mandatory, not optional, for Trees/Shrubs.**
   A dedicated `plant_woody_details` section (Bark color/surface/description, Stem color/form/surface/aromatic/description, Woody Plant Leaf Characteristics) appears — and must be filled in — whenever `taxonomic_type` is Tree or Shrub. It does not exist as a section for herbaceous plants.

3. **Propagation Strategy — herbaceous-only.**
   Lives in a `plant_herbaceous_details` section, populated for Herbaceous Perennial (and likely Annual/Biennial if those are added later). Not applicable to woody plants.

4. **Bloom Time — dual format.**
   - `bloom_seasons` — multi-select (Spring/Summer/Fall/Winter)
   - `bloom_window_text` — free text (e.g., "late March – early May")

   Note: bloom windows at this precision are unlikely to come from Perenual/Trefle/USDA — expect to source these from NC Extension-style write-ups or fill manually.

5. **All free-text description fields retained.**
   Description, Wildlife Value, Flower/Fruit/Leaf/Bark/Stem Description, and Insect/Disease Problems are all kept as long-text fields — none dropped as "fluff."

6. **Regional field — TN Level III Ecoregions (8 categories), flat reference table.**
   Replaces "NC Region." An `ecoregion_level3` lookup table with 8 entries:
   1. Blue Ridge
   2. Ridge and Valley
   3. Southwestern Appalachians
   4. Central Appalachians
   5. Southeastern Plains
   6. Interior Plateau
   7. Mississippi Alluvial Plain
   8. Mississippi Valley Loess Plains

   A plant's `distribution` can reference one or more of these (multi-select), since native ranges often span multiple ecoregions. Level IV (31 finer subregions) was considered but intentionally excluded for simplicity and data completeness — Level III is what's realistically sourceable from available distribution data.

   Note: cross-referencing a plant's actual presence in each TN ecoregion is a separate data-sourcing task (not provided directly by Perenual/Trefle/USDA) — likely manual or derived from USDA PLANTS state-level distribution + ecoregion maps as a starting approximation.

---

## Next Step

Validate this taxonomy against a live API call (e.g., Perenual) using one of the three reviewed species, to confirm field-name mappings and identify which attributes above can be auto-populated vs. require manual/NC-Extension sourcing.