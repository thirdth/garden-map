#!/usr/bin/env python3
"""
nc_extension_import.py — Load nc_extension_plants.jsonl into Supabase (PostgreSQL).

Usage:
  python3 scripts/nc_extension_import.py [options]

Options:
  --dry-run       Validate and transform without inserting (default when no DATABASE_URL)
  --limit N       Only process first N plants
  --slug SLUG     Process only this slug
  --db-url URL    PostgreSQL connection string (default: DATABASE_URL env var)

Requires: psycopg2-binary  (pip3 install psycopg2-binary)
"""

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
JSONL = ROOT / "data" / "nc_extension_plants.jsonl"

# ── Taxonomic type normalization ──────────────────────────────────────────────

DIRECT_TAXONOMIC_MAP = {
    "Herbaceous Perennial": "Herbaceous Perennial",
    "Annual":               "Annual",
    "Biennial":             "Biennial",
    "Tree":                 "Tree",
    "Shrub":                "Shrub",
    "Vine":                 "Vine",
    "Bulb":                 "Bulb",
    "Fern":                 "Fern",
    "Ground Cover":         "Ground Cover",
    "Ornamental Grasses and Sedges": "Ornamental Grass",
    "Rose":                 "Shrub",
    "Houseplant":           "Houseplant",
    "Epiphyte":             "Epiphyte",
}

# NC Extension sometimes puts ecological categories in the Plant Type field
ECOLOGICAL_AS_TYPE = {"Native Plant", "Wildflower", "Edible", "Poisonous"}

# Woody hints in ecological_tags that override a vague taxonomic_type
_TREE_TAGS  = {"large tree", "native tree", "conifer", "evergreen tree", "deciduous tree"}
_SHRUB_TAGS = {"shrub", "evergreen shrub", "deciduous shrub", "native shrub"}
_VINE_TAGS  = {"vine", "climbing vine"}
_FERN_TAGS  = {"fern"}


def _tag_woody_hint(eco_tags: list) -> str | None:
    tag_set = {t.lower() for t in eco_tags}
    if tag_set & _TREE_TAGS:
        return "Tree"
    if tag_set & _SHRUB_TAGS:
        return "Shrub"
    if tag_set & _VINE_TAGS:
        return "Vine"
    if tag_set & _FERN_TAGS:
        return "Fern"
    return None


def normalize_taxonomic_type(raw_type: str, life_cycle: str, eco_tags: list) -> str:
    # "Perennial" is ambiguous — NC Extension uses it for both shrubs and herbaceous.
    # Check eco_tags first; fall back to "Herbaceous Perennial" only if no woody hint.
    if raw_type == "Perennial":
        hint = _tag_woody_hint(eco_tags)
        if hint:
            return hint
        lc = (life_cycle or "").lower()
        if lc == "woody":
            return "Shrub"
        return "Herbaceous Perennial"

    if raw_type in DIRECT_TAXONOMIC_MAP:
        return DIRECT_TAXONOMIC_MAP[raw_type]

    # Ecological-as-type: infer from tags then life_cycle
    if raw_type in ECOLOGICAL_AS_TYPE:
        hint = _tag_woody_hint(eco_tags)
        if hint:
            return hint
        lc = (life_cycle or "").lower()
        if lc == "woody":
            return "Shrub"
        if lc == "perennial":
            return "Herbaceous Perennial"
        if lc == "annual":
            return "Annual"
        if lc == "biennial":
            return "Biennial"

    return raw_type or "Unknown"


def fix_species(plant: dict) -> tuple:
    """
    NC Extension sometimes parses cultivar names into the species slot for hybrids.
    Heuristic: a species epithet is always lowercase. If it's capitalized, it's a
    cultivar name segment that got split wrong.
    """
    genus = plant.get("genus", "")
    species = plant.get("species", "")
    cultivar = plant.get("cultivar")

    # Strip leading punctuation (quotes, apostrophes) before checking case
    species_alpha = species.lstrip("'\"×× ") if species else ""
    if species_alpha and species_alpha[0].isupper():
        cultivar = f"{species} {cultivar}".strip() if cultivar else species
        species = ""

    return genus, species or None, cultivar or None


def transform(plant: dict) -> dict:
    """Return a dict of plants-table columns plus nested keys for related tables."""
    genus, species, cultivar = fix_species(plant)
    raw_type   = plant.get("taxonomic_type", "")
    life_cycle = plant.get("life_cycle", "")
    eco_tags   = plant.get("ecological_tags") or []

    taxonomic_type  = normalize_taxonomic_type(raw_type, life_cycle, eco_tags)

    # Merge ecological-as-type back into tags
    tags = list(eco_tags)
    if raw_type in ECOLOGICAL_AS_TYPE and raw_type not in tags:
        tags.append(raw_type)

    return {
        # ── plants table ────────────────────────────────────────────────────
        "genus":           genus,
        "species":         species,
        "cultivar":        cultivar,
        "family":          plant.get("family"),

        "description":              plant.get("description"),
        "insect_disease_problems":  None,  # embedded in description; leave null
        "particularly_resistant_to": None,

        "country_of_origin":       plant.get("country_of_origin") or None,
        "usda_hardiness_zone_min": plant.get("usda_hardiness_zone_min"),
        "usda_hardiness_zone_max": plant.get("usda_hardiness_zone_max"),

        "life_cycle":      life_cycle or None,
        "taxonomic_type":  taxonomic_type,
        "ecological_tags": tags or None,
        "habit_form":      plant.get("habit_form") or None,
        "growth_rate":     plant.get("growth_rate"),
        "maintenance":     plant.get("maintenance"),
        "texture":         None,

        "height_min_ft":  plant.get("height_min_ft"),
        "height_max_ft":  plant.get("height_max_ft"),
        "spread_min_ft":  None,
        "spread_max_ft":  None,
        "spacing_min_ft": plant.get("spacing_min_ft"),
        "spacing_max_ft": plant.get("spacing_max_ft"),

        "light":         plant.get("light") or None,
        "soil_texture":  plant.get("soil_texture") or None,
        "soil_ph":       plant.get("soil_ph") or None,
        "soil_drainage": plant.get("soil_drainage") or None,
        "watering_need": None,

        "flower_color":         plant.get("flower_color") or None,
        "bloom_seasons":        plant.get("bloom_seasons") or None,
        "bloom_window_text":    None,
        "flower_inflorescence": plant.get("flower_inflorescence"),
        "flower_shape":         plant.get("flower_shape"),
        "flower_size_min_in":   plant.get("flower_size_min_in"),
        "flower_size_max_in":   plant.get("flower_size_max_in"),
        "flower_petals_min":    plant.get("flower_petals_min"),
        "flower_petals_max":    plant.get("flower_petals_max"),
        "flower_value":         plant.get("flower_value") or None,
        "flower_description":   plant.get("flower_description"),

        "fruit_color":          plant.get("fruit_color") or None,
        "fruit_type":           plant.get("fruit_type"),
        "fruit_length_min_in":  plant.get("fruit_length_min_in"),
        "fruit_length_max_in":  plant.get("fruit_length_max_in"),
        "fruit_width_min_in":   plant.get("fruit_width_min_in"),
        "fruit_width_max_in":   plant.get("fruit_width_max_in"),
        "fruit_value":          plant.get("fruit_value") or None,
        "fruit_harvest_time":   plant.get("fruit_harvest_time"),
        "fruit_description":    plant.get("fruit_description"),

        "leaf_color":          plant.get("leaf_color") or None,
        "leaf_feel":           plant.get("leaf_feel") or None,
        "leaf_type":           plant.get("leaf_type"),
        "leaf_arrangement":    plant.get("leaf_arrangement"),
        "leaf_shape":          plant.get("leaf_shape"),
        "leaf_margin":         plant.get("leaf_margin") or None,
        "leaf_length_min_in":  plant.get("leaf_length_min_in"),
        "leaf_length_max_in":  plant.get("leaf_length_max_in"),
        "leaf_width_min_in":   plant.get("leaf_width_min_in"),
        "leaf_width_max_in":   plant.get("leaf_width_max_in"),
        "hairs_present":       plant.get("hairs_present"),
        "deciduous_fall_color": None,
        "leaf_value":          plant.get("leaf_value") or None,
        "leaf_description":    plant.get("leaf_description"),

        "poisonous_to_humans": None,
        "poisonous_to_pets":   None,
        "medicinal":           None,
        "edible_fruit":        None,
        "edible_leaf":         None,

        "wildlife_value": plant.get("wildlife_value"),
        "attracts":       plant.get("attracts") or None,
        "play_value":     plant.get("play_value") or None,
        "fire_risk":      plant.get("fire_risk"),

        "landscape_location":        plant.get("landscape_location") or None,
        "landscape_theme":           plant.get("landscape_theme") or None,
        "design_feature":            plant.get("design_feature") or None,
        "resistance_to_challenges":  plant.get("resistance_to_challenges") or None,

        "stem_color":       plant.get("stem_color") or None,
        "stem_form":        plant.get("stem_form"),
        "stem_surface":     plant.get("stem_surface"),
        "stem_is_aromatic": plant.get("stem_is_aromatic"),
        "stem_description": plant.get("stem_description"),

        "nc_extension_slug": plant.get("slug"),
        "usda_symbol":       None,
        "trefle_id":         None,
        "perenual_id":       None,

        # ── related table payloads ───────────────────────────────────────────
        "_common_names":      plant.get("common_names") or [],
        "_synonyms":          plant.get("synonyms") or [],
        "_phonetic_spelling": plant.get("phonetic_spelling"),
        "_state_distribution": [c for c in (plant.get("state_distribution") or [])
                                if len(c) == 2 and c.isalpha()],
        "_relationships":     plant.get("relationships") or [],
        "_pests":             plant.get("pest_disease_insects") or [],
        "_diseases":          plant.get("pest_disease_diseases") or [],
        "_propagation":       plant.get("propagation_strategy") or [],
        "_woody_leaf_characteristics": plant.get("woody_leaf_characteristics"),
        "_bark_color":        plant.get("bark_color") or None,
        "_bark_description":  plant.get("bark_description"),
    }


# ── SQL helpers ───────────────────────────────────────────────────────────────

PLANT_COLS = [
    "genus", "species", "cultivar", "family",
    "description", "insect_disease_problems", "particularly_resistant_to",
    "country_of_origin", "usda_hardiness_zone_min", "usda_hardiness_zone_max",
    "life_cycle", "taxonomic_type", "ecological_tags", "habit_form",
    "growth_rate", "maintenance", "texture",
    "height_min_ft", "height_max_ft", "spread_min_ft", "spread_max_ft",
    "spacing_min_ft", "spacing_max_ft",
    "light", "soil_texture", "soil_ph", "soil_drainage", "watering_need",
    "flower_color", "bloom_seasons", "bloom_window_text", "flower_inflorescence",
    "flower_shape", "flower_size_min_in", "flower_size_max_in",
    "flower_petals_min", "flower_petals_max", "flower_value", "flower_description",
    "fruit_color", "fruit_type", "fruit_length_min_in", "fruit_length_max_in",
    "fruit_width_min_in", "fruit_width_max_in", "fruit_value",
    "fruit_harvest_time", "fruit_description",
    "leaf_color", "leaf_feel", "leaf_type", "leaf_arrangement", "leaf_shape",
    "leaf_margin", "leaf_length_min_in", "leaf_length_max_in",
    "leaf_width_min_in", "leaf_width_max_in", "hairs_present",
    "deciduous_fall_color", "leaf_value", "leaf_description",
    "poisonous_to_humans", "poisonous_to_pets", "medicinal",
    "edible_fruit", "edible_leaf",
    "wildlife_value", "attracts", "play_value", "fire_risk",
    "landscape_location", "landscape_theme", "design_feature",
    "resistance_to_challenges",
    "stem_color", "stem_form", "stem_surface", "stem_is_aromatic", "stem_description",
    "nc_extension_slug", "usda_symbol", "trefle_id", "perenual_id",
]

WOODY_TYPES = {"Tree", "Shrub"}
HERBACEOUS_TYPES = {"Herbaceous Perennial", "Annual", "Biennial"}


def upsert_plant(cur, rec: dict) -> str:
    """Insert or update a plant row; return the plant UUID."""
    cols = PLANT_COLS
    placeholders = ", ".join(["%s"] * len(cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "nc_extension_slug")

    sql = f"""
        INSERT INTO plants ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (nc_extension_slug) DO UPDATE SET {updates}
        RETURNING id
    """
    values = [rec[c] for c in cols]
    cur.execute(sql, values)
    return cur.fetchone()[0]


def insert_related(cur, plant_id: str, rec: dict) -> None:
    # Common names
    if rec["_common_names"]:
        cur.execute("DELETE FROM plant_common_names WHERE plant_id = %s", (plant_id,))
        for i, name in enumerate(rec["_common_names"]):
            cur.execute(
                "INSERT INTO plant_common_names (plant_id, name, is_primary) VALUES (%s, %s, %s)",
                (plant_id, name, i == 0),
            )

    # Synonyms
    if rec["_synonyms"]:
        cur.execute("DELETE FROM plant_synonyms WHERE plant_id = %s", (plant_id,))
        for syn in rec["_synonyms"]:
            cur.execute(
                "INSERT INTO plant_synonyms (plant_id, synonym) VALUES (%s, %s)",
                (plant_id, syn),
            )

    # Pronunciation
    if rec["_phonetic_spelling"]:
        cur.execute(
            """INSERT INTO plant_pronunciations (plant_id, phonetic_spelling)
               VALUES (%s, %s)
               ON CONFLICT (plant_id) DO UPDATE SET phonetic_spelling = EXCLUDED.phonetic_spelling""",
            (plant_id, rec["_phonetic_spelling"]),
        )

    # State distribution
    if rec["_state_distribution"]:
        cur.execute("DELETE FROM plant_state_distribution WHERE plant_id = %s", (plant_id,))
        for code in rec["_state_distribution"]:
            cur.execute(
                "INSERT INTO plant_state_distribution (plant_id, state_code) VALUES (%s, %s)",
                (plant_id, code),
            )

    # Relationships — store by text name; related_plant_id resolved in a later pass
    if rec["_relationships"]:
        cur.execute("DELETE FROM plant_relationships WHERE plant_id = %s", (plant_id,))
        for rel in rec["_relationships"]:
            cur.execute(
                """INSERT INTO plant_relationships
                   (plant_id, related_name_text, relationship_type)
                   VALUES (%s, %s, %s)""",
                (plant_id, rel.get("related_name_text"), rel.get("relationship_type")),
            )

    # Pests
    if rec["_pests"] or rec["_diseases"]:
        cur.execute("DELETE FROM plant_pest_disease WHERE plant_id = %s", (plant_id,))
        for name in rec["_pests"]:
            cur.execute(
                "INSERT INTO plant_pest_disease (plant_id, entry_type, name) VALUES (%s, %s, %s)",
                (plant_id, "pest", name),
            )
        for name in rec["_diseases"]:
            cur.execute(
                "INSERT INTO plant_pest_disease (plant_id, entry_type, name) VALUES (%s, %s, %s)",
                (plant_id, "disease", name),
            )

    # Woody details
    if rec["taxonomic_type"] in WOODY_TYPES:
        cur.execute(
            """INSERT INTO plant_woody_details
               (plant_id, woody_leaf_characteristics, bark_color, bark_description)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (plant_id) DO UPDATE SET
                 woody_leaf_characteristics = EXCLUDED.woody_leaf_characteristics,
                 bark_color = EXCLUDED.bark_color,
                 bark_description = EXCLUDED.bark_description""",
            (plant_id, rec["_woody_leaf_characteristics"],
             rec["_bark_color"], rec["_bark_description"]),
        )

    # Herbaceous details
    if rec["taxonomic_type"] in HERBACEOUS_TYPES and rec["_propagation"]:
        cur.execute(
            """INSERT INTO plant_herbaceous_details (plant_id, propagation_strategy)
               VALUES (%s, %s)
               ON CONFLICT (plant_id) DO UPDATE SET
                 propagation_strategy = EXCLUDED.propagation_strategy""",
            (plant_id, rec["_propagation"]),
        )


def resolve_relationships(cur) -> int:
    """Second pass: fill in related_plant_id where the related plant is now in DB."""
    cur.execute("""
        UPDATE plant_relationships pr
        SET related_plant_id = p.id
        FROM plants p
        WHERE pr.related_plant_id IS NULL
          AND pr.related_name_text IS NOT NULL
          AND (
            p.genus || ' ' || COALESCE(p.species, '') = pr.related_name_text
            OR EXISTS (
              SELECT 1 FROM plant_common_names cn
              WHERE cn.plant_id = p.id AND cn.name = pr.related_name_text
            )
          )
    """)
    return cur.rowcount


# ── Main ──────────────────────────────────────────────────────────────────────

def load_plants(slug_filter=None, limit=None) -> list:
    plants = []
    with open(JSONL) as f:
        for line in f:
            p = json.loads(line)
            if slug_filter and p.get("slug") != slug_filter:
                continue
            plants.append(p)
            if limit and len(plants) >= limit:
                break
    return plants


def run(args):
    plants = load_plants(slug_filter=args.slug, limit=args.limit)
    print(f"Loaded {len(plants)} plant(s) from JSONL")

    records = [transform(p) for p in plants]

    if args.dry_run:
        print("DRY RUN — transformation only, no DB writes")
        for rec in records[:3]:
            slug = rec["nc_extension_slug"]
            t    = rec["taxonomic_type"]
            print(f"  {slug}: {rec['genus']} {rec['species'] or ''} [{t}]"
                  f"  tags={len(rec['ecological_tags'] or [])}"
                  f"  rels={len(rec['_relationships'])}"
                  f"  pests={len(rec['_pests'])+len(rec['_diseases'])}")
        if len(records) > 3:
            print(f"  ... and {len(records)-3} more")
        return

    db_url = args.db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        sys.exit("ERROR: No database URL. Set DATABASE_URL or pass --db-url.")

    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        sys.exit("ERROR: pip3 install psycopg2-binary")

    conn = psycopg2.connect(db_url)

    # Wrap array fields so psycopg2 sends them as proper PG arrays, not strings
    def pg_array(val):
        return val  # psycopg2 handles Python lists natively for TEXT[] columns

    inserted = updated = errors = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for i, rec in enumerate(records, 1):
                    try:
                        plant_id = upsert_plant(cur, rec)
                        insert_related(cur, plant_id, rec)
                        inserted += 1
                        if i % 100 == 0:
                            print(f"  {i}/{len(records)} done", flush=True)
                    except Exception as e:
                        errors += 1
                        print(f"  ERROR [{rec['nc_extension_slug']}]: {e}")
                        conn.rollback()

                resolved = resolve_relationships(cur)
                print(f"Resolved {resolved} plant relationships")

        print(f"\nDone: {inserted} upserted, {errors} errors")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Transform only, no DB writes")
    ap.add_argument("--limit", type=int, metavar="N",
                    help="Process only first N plants")
    ap.add_argument("--slug", metavar="SLUG",
                    help="Process only this slug")
    ap.add_argument("--db-url", metavar="URL",
                    help="PostgreSQL connection string")
    args = ap.parse_args()

    if not args.dry_run and not args.db_url and not os.environ.get("DATABASE_URL"):
        print("No DATABASE_URL set — running in dry-run mode.")
        args.dry_run = True

    run(args)


if __name__ == "__main__":
    main()
