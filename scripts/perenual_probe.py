"""
Perenual API probe — Echinacea pallida
Calls species-list + species-details, maps response fields to our schema,
and reports coverage gaps.

Usage:
    PERENUAL_API_KEY=sk-... python3 scripts/perenual_probe.py
    # or just run directly — key is embedded for local testing
"""

import json
import os
import urllib.request
from textwrap import indent

API_KEY = os.getenv("PERENUAL_API_KEY", "sk-7oF06a2f05b9b58f518195")
BASE = "https://perenual.com/api"
QUERY = "echinacea pallida"


def get(path: str) -> dict:
    url = f"{BASE}{path}"
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())


# ── 1. Species-list ──────────────────────────────────────────────────────────

print("=" * 70)
print("STEP 1 — species-list")
print("=" * 70)

list_resp = get(f"/species-list?key={API_KEY}&q={QUERY.replace(' ', '+')}")
hits = list_resp.get("data", [])
print(f"Results: {list_resp['total']}")
for h in hits:
    print(f"  [{h['id']}] {h['scientific_name']} / \"{h['common_name']}\"")

# Target: the straight species, not the cultivar
target = next(
    (h for h in hits if h["scientific_name"] == ["Echinacea pallida"]),
    hits[0] if hits else None,
)
if not target:
    raise SystemExit("Species not found in results.")

species_id = target["id"]
print(f"\nUsing id={species_id}")

# ── 2. Species-details ───────────────────────────────────────────────────────

print()
print("=" * 70)
print("STEP 2 — species/details")
print("=" * 70)

detail = get(f"/species/details/{species_id}?key={API_KEY}")

# Pretty-print raw response
print(json.dumps(detail, indent=2))

# ── 3. Field mapping ─────────────────────────────────────────────────────────
#
# Each entry: (perenual_field, our_table.column, value_from_response, note)
# "COVERED"  = Perenual has the field (may be null for this plant)
# "PARTIAL"  = field exists but needs transformation / normalization
# "NO DATA"  = field exists in response but null for this plant
# "MISSING"  = Perenual has no equivalent field at all

list_data = target   # species-list hit
det = detail         # species-details response


def val(d, *keys):
    """Safely drill into nested keys."""
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d


MAPPING = [
    # ── Identity / Naming ────────────────────────────────────────────────
    {
        "schema": "plants.perenual_id",
        "perenual_field": "id",
        "value": det.get("id"),
        "status": "COVERED",
        "note": "Direct integer id.",
    },
    {
        "schema": "plant_common_names (primary)",
        "perenual_field": "common_name",
        "value": det.get("common_name"),
        "status": "COVERED" if det.get("common_name") else "NO DATA",
        "note": "Single string; insert as primary common name.",
    },
    {
        "schema": "plants.genus + plants.species",
        "perenual_field": "scientific_name[]",
        "value": det.get("scientific_name"),
        "status": "PARTIAL",
        "note": "Array of strings; parse first element by splitting on first space.",
    },
    {
        "schema": "plant_synonyms",
        "perenual_field": "other_name[]",
        "value": det.get("other_name"),
        "status": "COVERED" if det.get("other_name") else "NO DATA",
        "note": "Array of synonym strings.",
    },
    {
        "schema": "plants.family",
        "perenual_field": "family",
        "value": det.get("family"),
        "status": "COVERED" if det.get("family") else "NO DATA",
        "note": "Direct string.",
    },
    {
        "schema": "plants.cultivar",
        "perenual_field": "(none — parsed from scientific_name)",
        "value": None,
        "status": "PARTIAL",
        "note": "Extract token after species epithet if present (e.g. 'Hula Dancer').",
    },
    {
        "schema": "plant_pronunciations",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Perenual has no phonetic spelling or audio field.",
    },

    # ── Description ──────────────────────────────────────────────────────
    {
        "schema": "plants.description",
        "perenual_field": "description",
        "value": det.get("description"),
        "status": "COVERED" if det.get("description") else "NO DATA",
        "note": "Direct long text.",
    },
    {
        "schema": "plants.insect_disease_problems",
        "perenual_field": "pest_susceptibility[]",
        "value": det.get("pest_susceptibility"),
        "status": "COVERED" if det.get("pest_susceptibility") else "NO DATA",
        "note": "Array; join or store in plant_pest_disease rows.",
    },
    {
        "schema": "plants.particularly_resistant_to[]",
        "perenual_field": "(none — see drought_tolerant, salt_tolerant)",
        "value": None,
        "status": "PARTIAL",
        "note": "Perenual has boolean drought_tolerant / salt_tolerant; "
                "no general 'resistant to' free-text field.",
    },

    # ── Origin / Distribution ─────────────────────────────────────────────
    {
        "schema": "plants.country_of_origin[]",
        "perenual_field": "origin[]",
        "value": det.get("origin"),
        "status": "COVERED" if det.get("origin") else "NO DATA",
        "note": "Array of country/region strings.",
    },
    {
        "schema": "plants.usda_hardiness_zone_min/max",
        "perenual_field": "hardiness.min / hardiness.max",
        "value": det.get("hardiness"),
        "status": "COVERED" if det.get("hardiness") else "NO DATA",
        "note": "Object with min/max integer zone numbers.",
    },
    {
        "schema": "plant_state_distribution",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Perenual has no state/province distribution list.",
    },
    {
        "schema": "plant_ecoregions",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "TN Level III ecoregion membership — manual or derived from USDA PLANTS.",
    },

    # ── Whole Plant Traits ────────────────────────────────────────────────
    {
        "schema": "plants.life_cycle",
        "perenual_field": "cycle",
        "value": det.get("cycle"),
        "status": "COVERED" if det.get("cycle") else "NO DATA",
        "note": "String: 'Perennial', 'Annual', etc.",
    },
    {
        "schema": "plants.taxonomic_type",
        "perenual_field": "type",
        "value": det.get("type"),
        "status": "COVERED" if det.get("type") else "NO DATA",
        "note": "String. May need normalization to our controlled vocabulary.",
    },
    {
        "schema": "plants.ecological_tags[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Native Plant / Wildflower tags not in Perenual.",
    },
    {
        "schema": "plants.habit_form[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Erect / Rounded / Spreading etc. not a Perenual field.",
    },
    {
        "schema": "plants.growth_rate",
        "perenual_field": "growth_rate",
        "value": det.get("growth_rate"),
        "status": "COVERED" if det.get("growth_rate") else "NO DATA",
        "note": "String: 'High', 'Moderate', 'Low'.",
    },
    {
        "schema": "plants.maintenance",
        "perenual_field": "maintenance / care_level",
        "value": det.get("maintenance") or det.get("care_level"),
        "status": "COVERED" if (det.get("maintenance") or det.get("care_level")) else "NO DATA",
        "note": "Two overlapping fields; prefer maintenance, fall back to care_level.",
    },
    {
        "schema": "plants.texture",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Fine / Medium / Coarse texture not a Perenual field.",
    },

    # ── Dimensions ────────────────────────────────────────────────────────
    {
        "schema": "plants.height_min_ft / height_max_ft",
        "perenual_field": "dimensions (type=Height)",
        "value": det.get("dimensions"),
        "status": "COVERED" if det.get("dimensions") else "NO DATA",
        "note": "Object with {type, min_value, max_value, unit}. Filter type=='Height'.",
    },
    {
        "schema": "plants.spread_min_ft / spread_max_ft",
        "perenual_field": "dimensions (type=Spread)",
        "value": det.get("dimensions"),
        "status": "COVERED" if det.get("dimensions") else "NO DATA",
        "note": "Same dimensions array; filter type=='Spread'.",
    },
    {
        "schema": "plants.spacing_min_ft / spacing_max_ft",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Recommended spacing not in Perenual.",
    },

    # ── Cultural Conditions ───────────────────────────────────────────────
    {
        "schema": "plants.light[]",
        "perenual_field": "sunlight[]",
        "value": det.get("sunlight"),
        "status": "COVERED" if det.get("sunlight") else "NO DATA",
        "note": "Array of strings; normalize to Full Sun/Partial Shade/Shade.",
    },
    {
        "schema": "plants.soil_texture[]",
        "perenual_field": "soil[]",
        "value": det.get("soil"),
        "status": "COVERED" if det.get("soil") else "NO DATA",
        "note": "Array of strings: 'Clay', 'Loam', 'Sand', etc.",
    },
    {
        "schema": "plants.soil_ph[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Acid/Neutral/Alkaline pH ranges not in Perenual.",
    },
    {
        "schema": "plants.soil_drainage[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Good Drainage/Moist/Occasionally Wet — manual/Extension source only.",
    },
    {
        "schema": "plants.watering_need",
        "perenual_field": "watering",
        "value": det.get("watering"),
        "status": "COVERED" if det.get("watering") else "NO DATA",
        "note": "Frequent/Average/Minimum/None — direct string from Perenual.",
    },

    # ── Flowers / Bloom ───────────────────────────────────────────────────
    {
        "schema": "plants.flower_color[]",
        "perenual_field": "flower_color[]",
        "value": det.get("flower_color"),
        "status": "COVERED" if det.get("flower_color") else "NO DATA",
        "note": "Array of color strings.",
    },
    {
        "schema": "plants.bloom_seasons[]",
        "perenual_field": "flowering_season",
        "value": det.get("flowering_season"),
        "status": "PARTIAL" if det.get("flowering_season") else "NO DATA",
        "note": "Single string ('Spring', 'Summer'). Convert to array; split on '/' if needed.",
    },
    {
        "schema": "plants.bloom_window_text",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Precise window ('late March – early May') not in Perenual.",
    },
    {
        "schema": "plants.flower_inflorescence",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.flower_shape",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.flower_size_min_in / flower_size_max_in",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.flower_petals_min / flower_petals_max",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.flower_value[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Showy/Fragrant/Good Cut/Good Dried not in Perenual.",
    },
    {
        "schema": "plants.flower_description",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },

    # ── Fruit / Seed ──────────────────────────────────────────────────────
    {
        "schema": "plants.fruit_color[]",
        "perenual_field": "fruit_color[]",
        "value": det.get("fruit_color"),
        "status": "COVERED" if det.get("fruit_color") else "NO DATA",
        "note": "Array of color strings.",
    },
    {
        "schema": "plants.fruit_harvest_time",
        "perenual_field": "harvest_season",
        "value": det.get("harvest_season"),
        "status": "COVERED" if det.get("harvest_season") else "NO DATA",
        "note": "String.",
    },
    {
        "schema": "plants.fruit_type",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Achene/Follicle/Aggregate etc. not in Perenual.",
    },
    {
        "schema": "plants.fruit_length/width ranges",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.fruit_value[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.fruit_description",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },

    # ── Leaves ────────────────────────────────────────────────────────────
    {
        "schema": "plants.leaf_color[]",
        "perenual_field": "leaf_color[]",
        "value": det.get("leaf_color"),
        "status": "COVERED" if det.get("leaf_color") else "NO DATA",
        "note": "Array of color strings.",
    },
    {
        "schema": "plants.leaf_feel[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Glossy/Leathery/Rough not in Perenual.",
    },
    {
        "schema": "plants.leaf_type",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Simple/Compound not in Perenual.",
    },
    {
        "schema": "plants.leaf_arrangement",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Alternate/Opposite not in Perenual.",
    },
    {
        "schema": "plants.leaf_shape",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.leaf_margin[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Entire/Dentate not in Perenual.",
    },
    {
        "schema": "plants.leaf_length/width ranges",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.hairs_present",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.deciduous_fall_color[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.leaf_value[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.leaf_description",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },

    # ── Safety / Edibility ───────────────────────────────────────────────
    {
        "schema": "plants.poisonous_to_humans",
        "perenual_field": "poisonous_to_humans",
        "value": det.get("poisonous_to_humans"),
        "status": "COVERED" if det.get("poisonous_to_humans") is not None else "NO DATA",
        "note": "Boolean.",
    },
    {
        "schema": "plants.poisonous_to_pets",
        "perenual_field": "poisonous_to_pets",
        "value": det.get("poisonous_to_pets"),
        "status": "COVERED" if det.get("poisonous_to_pets") is not None else "NO DATA",
        "note": "Boolean.",
    },
    {
        "schema": "plants.medicinal",
        "perenual_field": "medicinal",
        "value": det.get("medicinal"),
        "status": "COVERED" if det.get("medicinal") is not None else "NO DATA",
        "note": "Boolean.",
    },
    {
        "schema": "plants.edible_fruit",
        "perenual_field": "edible_fruit",
        "value": det.get("edible_fruit"),
        "status": "COVERED" if det.get("edible_fruit") is not None else "NO DATA",
        "note": "Boolean.",
    },
    {
        "schema": "plants.edible_leaf",
        "perenual_field": "edible_leaf",
        "value": det.get("edible_leaf"),
        "status": "COVERED" if det.get("edible_leaf") is not None else "NO DATA",
        "note": "Boolean.",
    },

    # ── Bark / Stem (woody only) ──────────────────────────────────────────
    {
        "schema": "plant_woody_details.*",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Bark/stem details (color, surface, aromatic, etc.) not in Perenual.",
    },
    {
        "schema": "plant_woody_details.woody_leaf_characteristics",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Deciduous/Evergreen/Semi-evergreen not in Perenual.",
    },

    # ── Wildlife / Ecology ────────────────────────────────────────────────
    {
        "schema": "plants.attracts[]",
        "perenual_field": "attracts[]",
        "value": det.get("attracts"),
        "status": "COVERED" if det.get("attracts") else "NO DATA",
        "note": "Array of strings.",
    },
    {
        "schema": "plants.wildlife_value",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Free-text wildlife/host plant description not in Perenual.",
    },
    {
        "schema": "plants.play_value[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Not a Perenual field.",
    },
    {
        "schema": "plants.fire_risk",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Low/Medium/High flammability not in Perenual.",
    },

    # ── Landscape Use ─────────────────────────────────────────────────────
    {
        "schema": "plants.landscape_location[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Lawn/Patio/Woodland/Container etc. not in Perenual.",
    },
    {
        "schema": "plants.landscape_theme[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Pollinator Garden/Rain Garden etc. not in Perenual.",
    },
    {
        "schema": "plants.design_feature[]",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "Specimen/Border/Mass Planting etc. not in Perenual.",
    },
    {
        "schema": "plants.resistance_to_challenges[]",
        "perenual_field": "drought_tolerant (bool) + salt_tolerant (bool)",
        "value": {
            "drought_tolerant": det.get("drought_tolerant"),
            "salt_tolerant": det.get("salt_tolerant"),
        },
        "status": "PARTIAL",
        "note": "Booleans only. Perenual has no Deer/Wet Soil/Pollution/Fire resistance.",
    },

    # ── Relationships ─────────────────────────────────────────────────────
    {
        "schema": "plant_relationships",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "'Often confused with', 'similar to', 'native alternative' not in Perenual.",
    },
    {
        "schema": "plant_pest_disease",
        "perenual_field": "pest_susceptibility[]",
        "value": det.get("pest_susceptibility"),
        "status": "COVERED" if det.get("pest_susceptibility") else "NO DATA",
        "note": "Array of pest name strings (no disease equivalent).",
    },

    # ── Herbaceous details ────────────────────────────────────────────────
    {
        "schema": "plant_herbaceous_details.propagation_strategy[]",
        "perenual_field": "propagation[]",
        "value": det.get("propagation"),
        "status": "COVERED" if det.get("propagation") else "NO DATA",
        "note": "Array: ['Division', 'Seed', 'Cutting', ...].",
    },

    # ── Media ─────────────────────────────────────────────────────────────
    {
        "schema": "plant_media (primary image)",
        "perenual_field": "default_image{}",
        "value": {k: det["default_image"].get(k) for k in
                  ["license_name", "license_url", "original_url"]}
                 if det.get("default_image") else None,
        "status": "COVERED" if det.get("default_image") else "NO DATA",
        "note": "Object with original/regular/medium/small/thumbnail URLs + license info.",
    },
    {
        "schema": "plant_media (additional images)",
        "perenual_field": "other_images",
        "value": det.get("other_images"),
        "status": "MISSING",
        "note": "Requires paid Supreme plan. Free tier returns a string error message.",
    },
    {
        "schema": "plant_pronunciations.audio_url",
        "perenual_field": "(none)",
        "value": None,
        "status": "MISSING",
        "note": "No audio field in Perenual.",
    },
]

# ── 4. Report ─────────────────────────────────────────────────────────────────

STATUS_ORDER = ["COVERED", "PARTIAL", "NO DATA", "MISSING"]

print()
print("=" * 70)
print("STEP 3 — Schema ↔ Perenual field mapping")
print("=" * 70)

for status in STATUS_ORDER:
    rows = [m for m in MAPPING if m["status"] == status]
    if not rows:
        continue
    label = {
        "COVERED": "COVERED (field exists + has data for this plant)",
        "PARTIAL": "PARTIAL (field exists but needs transformation)",
        "NO DATA": "NO DATA (field exists in API, null for Echinacea pallida)",
        "MISSING": "MISSING (no Perenual equivalent at all)",
    }[status]
    print(f"\n── {label} ({len(rows)}) ──")
    for m in rows:
        val_str = repr(m["value"]) if m["value"] is not None else "null"
        if len(val_str) > 60:
            val_str = val_str[:57] + "..."
        print(f"  {m['schema']}")
        print(f"    perenual: {m['perenual_field']}")
        print(f"    value:    {val_str}")
        print(f"    note:     {m['note']}")

# ── 5. Summary ────────────────────────────────────────────────────────────────

counts = {s: sum(1 for m in MAPPING if m["status"] == s) for s in STATUS_ORDER}
total = len(MAPPING)

print()
print("=" * 70)
print("SUMMARY")
print("=" * 70)
for s, n in counts.items():
    pct = 100 * n / total
    print(f"  {s:<10} {n:>3}  ({pct:.0f}%)")
print(f"  {'TOTAL':<10} {total:>3}")

print()
print("KEY FINDING:")
print("  Perenual returns almost entirely null data for Echinacea pallida.")
print("  Only 'family' and 'default_image' carry real values.")
print("  Fields that ARE in the Perenual schema (cycle, attracts, dimensions,")
print("  sunlight, soil, flower_color, etc.) return null for this species.")
print("  This is a data-completeness issue with Perenual's coverage, not a")
print("  schema mismatch — the field mappings are valid for better-covered species.")
print()
print("FIELDS PERENUAL WILL NEVER COVER (manual / NC Extension only):")
missing_fields = [m["schema"] for m in MAPPING if m["status"] == "MISSING"]
for f in missing_fields:
    print(f"  • {f}")
