"""
NC Extension Plant Toolbox — Scraper
https://plants.ces.ncsu.edu

Phases (run in order, or all at once):
  python3 scripts/nc_extension_scraper.py --discover   # collect all slugs
  python3 scripts/nc_extension_scraper.py --fetch      # download HTML (resumable)
  python3 scripts/nc_extension_scraper.py --parse      # parse HTML → schema JSON
  python3 scripts/nc_extension_scraper.py --all        # run all three in sequence

Output:
  data/nc_extension/slugs.json           all discovered plant slugs
  data/nc_extension/html/{slug}.html     cached raw HTML (one per plant)
  data/nc_extension/plants/{slug}.json   parsed schema-mapped JSON
  data/nc_extension_plants.jsonl         combined output (one JSON object per line)

Rate: 1.5 s between requests. Already-cached files are skipped on re-runs.
"""

import argparse
import html as html_module
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data" / "nc_extension"
HTML_DIR = DATA / "html"
PLANTS_DIR = DATA / "plants"
SLUGS_FILE = DATA / "slugs.json"
JSONL_OUT = ROOT / "data" / "nc_extension_plants.jsonl"

for d in (DATA, HTML_DIR, PLANTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

BASE = "https://plants.ces.ncsu.edu"
HEADERS = {"User-Agent": "garden-map-importer/1.0 (personal plant database project)"}
DELAY = 1.5  # seconds between requests


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8", errors="replace")


# ── Phase 1: Discover slugs ───────────────────────────────────────────────────

def discover_slugs() -> list[str]:
    if SLUGS_FILE.exists():
        slugs = json.loads(SLUGS_FILE.read_text())
        print(f"[discover] loaded {len(slugs)} slugs from cache")
        return slugs

    slugs: list[str] = []
    page = 1
    while True:
        url = f"{BASE}/find_a_plant/?page={page}"
        print(f"[discover] page {page} — {url}")
        try:
            html = fetch(url)
        except Exception as e:
            print(f"  error: {e}")
            break

        found = re.findall(r'href="/plants/([^/"]+)/"', html)
        unique = list(dict.fromkeys(found))
        if not unique:
            break
        slugs.extend(s for s in unique if s not in slugs)
        print(f"  +{len(unique)} slugs  (total {len(slugs)})")

        # Check if there's a next page
        if f'?page={page + 1}' not in html:
            break
        page += 1
        time.sleep(DELAY)

    SLUGS_FILE.write_text(json.dumps(slugs, indent=2))
    print(f"[discover] done — {len(slugs)} slugs saved to {SLUGS_FILE}")
    return slugs


# ── Phase 2: Fetch HTML ───────────────────────────────────────────────────────

def fetch_html(slugs: list[str]) -> None:
    total = len(slugs)
    for i, slug in enumerate(slugs, 1):
        out = HTML_DIR / f"{slug}.html"
        if out.exists():
            continue  # already cached
        url = f"{BASE}/plants/{slug}/"
        print(f"[fetch] {i}/{total}  {slug}")
        try:
            html = fetch(url)
            out.write_text(html, encoding="utf-8")
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code} — skipping")
        except Exception as e:
            print(f"  error: {e} — skipping")
        time.sleep(DELAY)
    print("[fetch] done")


# ── Phase 3: Parse HTML → schema JSON ────────────────────────────────────────

def clean(s: str) -> str:
    """Strip tags, decode entities, collapse whitespace."""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html_module.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def main_content(html: str) -> str:
    """Return only the <main>…</main> block to avoid parsing sidebar content."""
    m = re.search(r"<main[^>]*>(.*?)</main>", html, re.DOTALL)
    return m.group(1) if m else html


def left_menu(html: str) -> str:
    """Return sidebar content before <main> (relationships and pest/disease live here)."""
    main_start = html.find("<main")
    return html[:main_start] if main_start > 0 else ""


def parse_dt_dd(html: str) -> dict[str, list[str]]:
    """
    Extract all <dt>…</dt> followed by one or more <dd>…</dd> blocks.
    Returns {label: [value, value, …]} collecting all dd values per dt.
    Scoped to <main> content to avoid sidebar contamination.
    """
    html = main_content(html)
    result: dict[str, list[str]] = {}
    # Split on <dt> boundaries
    parts = re.split(r"<dt[^>]*>", html)
    for part in parts[1:]:  # first split is before any <dt>
        dt_end = part.find("</dt>")
        if dt_end == -1:
            continue
        label = clean(part[:dt_end]).rstrip(":").strip()
        if not label:
            continue
        dd_section = part[dt_end:]
        # Collect all <span class="detail_display_attribute"> values
        values = [
            clean(v)
            for v in re.findall(
                r'<span[^>]*class="detail_display_attribute"[^>]*>(.*?)</span>',
                dd_section,
                re.DOTALL,
            )
            if clean(v)
        ]
        # Fallback: plain <dd> text if no spans found
        if not values:
            values = [
                clean(v)
                for v in re.findall(r"<dd[^>]*>(.*?)</dd>", dd_section, re.DOTALL)
                if clean(v)
            ]
        if label in result:
            result[label].extend(v for v in values if v not in result[label])
        else:
            result[label] = values
    return result


def parse_identity(html: str) -> dict:
    """Extract genus, species, cultivar, common names, synonyms from header."""
    identity: dict = {}
    main = main_content(html)

    # Scientific name from <title>
    sci = re.search(r"<title[^>]*>\s*(.*?)\s*[\|(]", html)
    if sci:
        name = clean(sci.group(1)).strip()
        parts = name.split()
        if len(parts) >= 2:
            identity["genus"] = parts[0]
            identity["species"] = parts[1]
            if len(parts) > 2:
                identity["cultivar"] = " ".join(parts[2:]).strip("'\"")

    # Common names — <ul id="common_names"> li a
    common = re.findall(r'<ul[^>]*id="common_names"[^>]*>(.*?)</ul>', main, re.DOTALL)
    if common:
        identity["common_names"] = [
            clean(c) for c in re.findall(r"<a[^>]*>(.*?)</a>", common[0], re.DOTALL)
            if clean(c)
        ]

    # Previously known as (synonyms) — scoped to main
    syn_block = re.search(
        r"Previously known as:(.*?)(?:<dt|</dl|<h[23])", main, re.DOTALL | re.IGNORECASE
    )
    if syn_block:
        syns = re.findall(r"<(?:a|em)[^>]*>(.*?)</(?:a|em)>", syn_block.group(1))
        identity["synonyms"] = [clean(s) for s in syns if clean(s)]

    return identity


def parse_relationships(html: str) -> list[dict]:
    """Parse relationship DT/DDs from the left sidebar."""
    sidebar = left_menu(html)
    if not sidebar:
        return []
    mapping = {
        "confused with": "confused_with",
        "similar but less problematic": "similar_to",
        "fill a similar niche": "fills_niche",
        "native alternative": "native_alternative_for",
    }
    rels = []
    parts = re.split(r"<dt[^>]*>", sidebar)
    for part in parts[1:]:
        dt_end = part.find("</dt>")
        if dt_end == -1:
            continue
        label = clean(part[:dt_end]).lower()
        rel_type = next((v for k, v in mapping.items() if k in label), None)
        if not rel_type:
            continue
        names = [
            clean(a)
            for a in re.findall(r"<a[^>]*>(.*?)</a>", part[dt_end:], re.DOTALL)
            if clean(a)
        ]
        for name in names:
            rels.append({"relationship_type": rel_type, "related_name_text": name})
    return rels


def parse_dimensions(dim_str: str) -> dict:
    """Parse 'Height: 2 ft. 0 in. - 3 ft. 0 in.' into min/max feet."""
    out = {}
    m = re.search(
        r"Height:\s*(\d+)\s*ft\.?\s*(\d+)?\s*in\.?\s*[-–]\s*(\d+)\s*ft\.?\s*(\d+)?\s*in",
        dim_str,
        re.IGNORECASE,
    )
    if m:
        ft_lo, in_lo, ft_hi, in_hi = (int(x or 0) for x in m.groups())
        out["height_min_ft"] = round(ft_lo + in_lo / 12, 2)
        out["height_max_ft"] = round(ft_hi + in_hi / 12, 2)
    else:
        # Single height value
        m2 = re.search(r"Height:\s*(\d+)\s*ft\.?\s*(\d+)?\s*in", dim_str, re.IGNORECASE)
        if m2:
            ft, inc = int(m2.group(1)), int(m2.group(2) or 0)
            out["height_max_ft"] = round(ft + inc / 12, 2)
    return out


def parse_spacing(space_str: str) -> dict:
    """Parse '12 inches-3 feet' into min/max feet."""
    out = {}
    # Convert everything to inches first
    def to_inches(val_str: str) -> float | None:
        val_str = val_str.strip().lower()
        m = re.match(r"(\d+(?:\.\d+)?)\s*(inch|inches|in|foot|feet|ft)", val_str)
        if not m:
            return None
        n = float(m.group(1))
        unit = m.group(2)
        return n if "in" in unit else n * 12

    parts = re.split(r"[-–]", space_str)
    if len(parts) == 2:
        lo = to_inches(parts[0])
        hi = to_inches(parts[1])
        if lo is not None:
            out["spacing_min_ft"] = round(lo / 12, 2)
        if hi is not None:
            out["spacing_max_ft"] = round(hi / 12, 2)
    elif len(parts) == 1:
        hi = to_inches(parts[0])
        if hi is not None:
            out["spacing_max_ft"] = round(hi / 12, 2)
    return out


def parse_zones(zone_str: str) -> dict:
    """Parse '3a, 3b, 4a … 10b' into min/max zone integers."""
    nums = [int(re.match(r"(\d+)", z.strip()).group(1))
            for z in zone_str.split(",") if re.match(r"\d", z.strip())]
    if nums:
        return {"usda_hardiness_zone_min": min(nums), "usda_hardiness_zone_max": max(nums)}
    return {}


def parse_range_inches(val_str: str) -> dict[str, float]:
    """
    Parse things like '1-3 inches', '7 - 20 petals/rays', '< 1 inch', '> 6 inches'
    into {min: x, max: y}.
    """
    out = {}
    val_str = val_str.lower()
    # Range: '1-3' or '7 - 20'
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)", val_str)
    if m:
        out["min"] = float(m.group(1))
        out["max"] = float(m.group(2))
        return out
    # Less than: '< 1'
    m = re.search(r"<\s*(\d+(?:\.\d+)?)", val_str)
    if m:
        out["max"] = float(m.group(1))
        return out
    # Greater than: '> 6'
    m = re.search(r">\s*(\d+(?:\.\d+)?)", val_str)
    if m:
        out["min"] = float(m.group(1))
        return out
    # Single number
    m = re.search(r"(\d+(?:\.\d+)?)", val_str)
    if m:
        out["min"] = out["max"] = float(m.group(1))
    return out


def parse_fire_risk(val_str: str) -> str | None:
    v = val_str.lower()
    if "low" in v:
        return "Low"
    if "medium" in v:
        return "Medium"
    if "high" in v:
        return "High"
    return None


def normalize_light(vals: list[str]) -> list[str]:
    out = []
    for v in vals:
        vl = v.lower()
        if "full sun" in vl:
            out.append("Full Sun")
        elif "partial" in vl or "part" in vl:
            out.append("Partial Shade")
        elif "shade" in vl or "deep shade" in vl:
            out.append("Shade")
        else:
            out.append(v)
    return list(dict.fromkeys(out))


def parse_tags(html: str) -> list[str]:
    """Extract tags from the Tags <dd class="tags"> block, using link text not slug."""
    main = main_content(html)
    m = re.search(r">Tags:</dt>(.*?)(?:<dt|</dl)", main, re.DOTALL)
    if not m:
        return []
    block = m.group(1)
    # Use visible link text (e.g. '#perennial'), not data-tag slug ('perennial_1')
    raw = re.findall(r'<a[^>]*data-tag="[^"]+"[^>]*>#?([^<]+)</a>', block)
    seen: set[str] = set()
    out: list[str] = []
    for t in raw:
        readable = t.strip()
        if readable and readable not in seen:
            seen.add(readable)
            out.append(readable)
    return out


def parse_pest_disease(html: str) -> dict:
    """Extract insect and disease problem names from the left sidebar."""
    sidebar = left_menu(html)
    if not sidebar:
        return {}
    result: dict[str, list[str]] = {"insects": [], "diseases": []}
    parts = re.split(r"<dt[^>]*>", sidebar)
    for part in parts[1:]:
        dt_end = part.find("</dt>")
        if dt_end == -1:
            continue
        label = clean(part[:dt_end]).lower()
        names = [
            clean(a)
            for a in re.findall(
                r'<dd[^>]*class="[^"]*list-group-item[^"]*"[^>]*>.*?<a[^>]*>(.*?)</a>',
                part[dt_end:], re.DOTALL,
            )
            if clean(a)
        ]
        if "insect" in label:
            result["insects"].extend(names)
        elif "disease" in label:
            result["diseases"].extend(names)
    return {k: v for k, v in result.items() if v}


def parse_distribution(dist_str: str) -> list[str]:
    return [s.strip() for s in re.split(r"[,\s]+", dist_str) if re.match(r"[A-Z]{2}", s.strip())]


def parse_plant(slug: str, html: str) -> dict:
    fields = parse_dt_dd(html)
    identity = parse_identity(html)
    relationships = parse_relationships(html)

    def first(key: str) -> str | None:
        return fields.get(key, [None])[0]

    def multi(key: str) -> list[str]:
        return fields.get(key, [])

    plant: dict = {
        "slug": slug,
        "nc_extension_url": f"{BASE}/plants/{slug}/",
        # Identity
        "genus": identity.get("genus"),
        "species": identity.get("species"),
        "cultivar": identity.get("cultivar"),
        "family": first("Family"),
        "common_names": identity.get("common_names", []),
        "synonyms": identity.get("synonyms", []),
        # Description
        "description": first("Description"),
        # Origin
        "country_of_origin": multi("Country Or Region Of Origin"),
        "state_distribution": parse_distribution(first("Distribution") or ""),
        # Whole plant traits
        "life_cycle": first("Life Cycle"),
        "taxonomic_type": first("Plant Type"),
        "ecological_tags": parse_tags(html),
        "habit_form": multi("Habit/Form"),
        "growth_rate": first("Growth Rate"),
        "maintenance": first("Maintenance"),
        "texture": first("Foliage Texture"),  # rarely on NC Extension pages
        # Dimensions
        **parse_dimensions(first("Dimensions") or ""),
        **parse_spacing(first("Available Space To Plant") or ""),
        # Cultural conditions
        "light": normalize_light(multi("Light")),
        "soil_texture": multi("Soil Texture"),
        "soil_ph": multi("Soil pH"),
        "soil_drainage": multi("Soil Drainage"),
        # Flowers
        "flower_color": multi("Flower Color"),
        "bloom_seasons": multi("Flower Bloom Time"),
        "flower_inflorescence": first("Flower Inflorescence"),
        "flower_shape": first("Flower Shape"),
        "flower_value": multi("Flower Value To Gardener"),
        "flower_description": first("Flower Description"),
        # Flower size
        **{f"flower_size_{k}_in": v
           for k, v in parse_range_inches(first("Flower Size") or "").items()},
        # Flower petals
        **{f"flower_petals_{k}": int(v)
           for k, v in parse_range_inches(first("Flower Petals") or "").items()
           if v == int(v)},
        # Fruit
        "fruit_color": multi("Fruit Color"),
        "fruit_type": first("Fruit Type"),
        "fruit_value": multi("Fruit Value To Gardener"),
        "fruit_harvest_time": first("Display/Harvest Time"),
        "fruit_description": first("Fruit Description"),
        **{f"fruit_length_{k}_in": v
           for k, v in parse_range_inches(first("Fruit Length") or "").items()},
        **{f"fruit_width_{k}_in": v
           for k, v in parse_range_inches(first("Fruit Width") or "").items()},
        # Leaves
        "leaf_color": multi("Leaf Color"),
        "leaf_feel": multi("Leaf Feel"),
        "leaf_type": first("Leaf Type"),
        "leaf_arrangement": first("Leaf Arrangement"),
        "leaf_shape": first("Leaf Shape"),
        "leaf_margin": multi("Leaf Margin"),
        "hairs_present": (first("Hairs Present") or "").lower() == "yes" or None,
        "leaf_value": multi("Leaf Value To Gardener"),
        "leaf_description": first("Leaf Description"),
        **{f"leaf_length_{k}_in": v
           for k, v in parse_range_inches(first("Leaf Length") or "").items()},
        **{f"leaf_width_{k}_in": v
           for k, v in parse_range_inches(first("Leaf Width") or "").items()},
        # Bark/stem (present for all plant types on NC Extension)
        "stem_color": multi("Stem Color"),
        "stem_form": first("Stem Form"),
        "stem_surface": first("Stem Surface"),
        "stem_is_aromatic": (first("Stem Is Aromatic") or "").lower() == "yes" or None,
        "stem_description": first("Stem Description"),
        "bark_color": multi("Bark Color"),
        "bark_surface": first("Bark Attachment") or first("Bark Surface"),
        "bark_description": first("Bark Description"),
        "woody_leaf_characteristics": first("Woody Plant Leaf Characteristics"),
        # Wildlife / ecology
        "wildlife_value": first("Wildlife Value"),
        "attracts": multi("Attracts"),
        "play_value": multi("Play Value"),
        "fire_risk": parse_fire_risk(first("Fire Risk Rating") or ""),
        # Landscape use
        "landscape_location": multi("Landscape Location"),
        "landscape_theme": multi("Landscape Theme"),
        "design_feature": multi("Design Feature"),
        "resistance_to_challenges": multi("Resistance To Challenges"),
        # Hardiness
        **parse_zones(first("USDA Plant Hardiness Zone") or ""),
        # Propagation
        "propagation_strategy": multi("Recommended Propagation Strategy"),
        # Pronunciation
        "phonetic_spelling": first("Phonetic Spelling"),
        # Relationships
        "relationships": relationships,
        # Pests / diseases
        **{f"pest_disease_{k}": v
           for k, v in parse_pest_disease(html).items() if v},
    }

    # Strip None and empty lists for cleanliness
    return {k: v for k, v in plant.items()
            if v is not None and v != [] and v != "" and v != {}}


def parse_all(slugs: list[str]) -> None:
    total = len(slugs)
    parsed = 0
    skipped = 0
    for i, slug in enumerate(slugs, 1):
        html_file = HTML_DIR / f"{slug}.html"
        out_file = PLANTS_DIR / f"{slug}.json"

        if out_file.exists():
            skipped += 1
            continue
        if not html_file.exists():
            print(f"[parse] {i}/{total}  {slug} — no HTML, skipping")
            continue

        html = html_file.read_text(encoding="utf-8")
        try:
            plant = parse_plant(slug, html)
            out_file.write_text(json.dumps(plant, indent=2, ensure_ascii=False))
            parsed += 1
        except Exception as e:
            print(f"[parse] {i}/{total}  {slug} — ERROR: {e}")

    print(f"[parse] done — {parsed} parsed, {skipped} already cached")

    # Combine into JSONL
    print(f"[parse] writing {JSONL_OUT}")
    with JSONL_OUT.open("w", encoding="utf-8") as f:
        for p in sorted(PLANTS_DIR.glob("*.json")):
            f.write(p.read_text(encoding="utf-8").replace("\n", " ") + "\n")
    line_count = sum(1 for _ in JSONL_OUT.open())
    print(f"[parse] {JSONL_OUT.name} — {line_count} plants")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--discover", action="store_true", help="Collect all plant slugs")
    parser.add_argument("--fetch", action="store_true", help="Download HTML for all slugs")
    parser.add_argument("--parse", action="store_true", help="Parse cached HTML → JSON")
    parser.add_argument("--all", action="store_true", help="Run all three phases")
    parser.add_argument("--slug", help="Test a single slug (fetch + parse, skip discovery)")
    args = parser.parse_args()

    if args.slug:
        slug = args.slug.strip("/").split("/")[-1]
        html_file = HTML_DIR / f"{slug}.html"
        if not html_file.exists():
            print(f"Fetching {slug}…")
            html = fetch(f"{BASE}/plants/{slug}/")
            html_file.write_text(html)
        html = html_file.read_text()
        plant = parse_plant(slug, html)
        print(json.dumps(plant, indent=2, ensure_ascii=False))
        return

    if not any([args.discover, args.fetch, args.parse, args.all]):
        parser.print_help()
        return

    slugs = discover_slugs() if (args.discover or args.all) else (
        json.loads(SLUGS_FILE.read_text()) if SLUGS_FILE.exists() else []
    )

    if args.fetch or args.all:
        if not slugs:
            print("No slugs — run --discover first")
            sys.exit(1)
        fetch_html(slugs)

    if args.parse or args.all:
        if not slugs:
            slugs = [p.stem for p in HTML_DIR.glob("*.html")]
        parse_all(slugs)


if __name__ == "__main__":
    main()
