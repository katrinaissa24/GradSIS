import os
import re
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("VITE_SUPABASE_ANON_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "Missing Supabase env vars. Need VITE_SUPABASE_URL and either "
        "SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY."
    )

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "gen_ed_courses.csv")

def normalize_whitespace(s: str) -> str:
    s = s.replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def parse_subject(course_str: str) -> str:
    course_str = normalize_whitespace(course_str)
    first_part = course_str.split("/")[0]
    subject = first_part.split(" ")[0]
    return subject.strip()

# --- Your 8 UI buckets ---
# English Communication
# Arabic Communication
# Human Values
# Cultures and Histories
# Societies and Individuals
# Understanding the World
# Technical Elective
# Community Engaged Learning
#
# DB enum values:
# Engl. Communication, Arab. Communication, Human Values, Cultures & Histories,
# Societies & Individuals, Understanding the World, Elective, CEL, ...

# Map ANY incoming label (PDF/CSV) -> DB enum label (must be one of the enum values)
ATTRIBUTE_TO_ENUM = {
    # Direct enum values (passthrough)
    "Engl. Communication": "Engl. Communication",
    "Arab. Communication": "Arab. Communication",
    "Human Values": "Human Values",
    "Cultures & Histories": "Cultures & Histories",
    "Societies & Individuals": "Societies & Individuals",
    "Understanding the World": "Understanding the World",
    "Elective": "Elective",
    "CEL": "CEL",

    # Friendly bucket names -> enum
    "English Communication": "Engl. Communication",
    "Arabic Communication": "Arab. Communication",
    "Cultures and Histories": "Cultures & Histories",
    "Societies and Individuals": "Societies & Individuals",
    "Community Engaged Learning": "CEL",
    "Technical Elective": "Elective",

    # PDF variants / hyphenation
    "Community-Engaged Learning": "CEL",
    "Community Engaged Learning": "CEL",
    "Cultures and Histories": "Cultures & Histories",
    "Societies and Individuals": "Societies & Individuals",

    # PDF “extra labels” that are NOT in your buckets -> force-map
    "Social Inequalities": "Societies & Individuals",
    "History of Ideas": "Cultures & Histories",
    "Writing in the Discipline": "Engl. Communication",
    "Quantitative Reasoning": "Understanding the World",

    # If you ever re-use pre-fall labels:
    "Arabic Communications Skills": "Arab. Communication",
    "English Communications Skills": "Engl. Communication",
    "Humanities List I": "Cultures & Histories",
    "Humanities List II": "Cultures & Histories",
    "Social Sciences List I": "Societies & Individuals",
    "Social Sciences List II": "Societies & Individuals",
    "Natural Sciences": "Understanding the World",
}

# Phrases that may appear glued with the attribute cell; remove them to detect the core attribute
SECONDARY_TAGS = [
    # these might appear alongside the real bucket text
    "Social Inequalities",
    "History of Ideas",
    "Writing in the Discipline",
]

def best_match_in_text(text: str):
    """
    Find the longest key in ATTRIBUTE_TO_ENUM that appears anywhere in text.
    Returns (key, enum, start, end) or None.
    """
    best = None
    for key, enum in ATTRIBUTE_TO_ENUM.items():
        idx = text.find(key)
        if idx == -1:
            continue
        cand = (len(key), key, enum, idx, idx + len(key))
        if best is None or cand[0] > best[0]:
            best = cand
    if best is None:
        return None
    _, key, enum, s, e = best
    return key, enum, s, e

def map_attribute(row) -> str | None:
    # We only trust fall_2023_attribute (you deleted column 3)
    raw = row.get("fall_2023_attribute")
    raw = "" if pd.isna(raw) else normalize_whitespace(str(raw))
    if not raw:
        return None

    # Special case from PDF: "Understanding Communication" must split to Arabic/English based on course
    if raw == "Understanding Communication":
        course_raw = normalize_whitespace(str(row.get("course", "")))
        return "Arab. Communication" if course_raw.startswith("ARAB") else "Engl. Communication"

    # Direct map
    if raw in ATTRIBUTE_TO_ENUM:
        return ATTRIBUTE_TO_ENUM[raw]

    # Sometimes the attribute cell is glued with other words; try to extract a match anywhere
    match = best_match_in_text(raw)
    if match:
        key, enum, s, e = match
        # If there's extra text before/after, append it to title (fixes your CSV glue)
        extra = normalize_whitespace((raw[:s] + " " + raw[e:]).strip())
        if extra:
            title = row.get("title")
            title = "" if pd.isna(title) else normalize_whitespace(str(title))
            if extra.lower() not in title.lower():
                row["title"] = normalize_whitespace(f"{title} {extra}")
        return enum

    # Last chance: remove known secondary tags then match again
    cleaned = raw
    for tag in SECONDARY_TAGS:
        cleaned = cleaned.replace(tag, " ")
    cleaned = normalize_whitespace(cleaned)
    if cleaned in ATTRIBUTE_TO_ENUM:
        return ATTRIBUTE_TO_ENUM[cleaned]

    match2 = best_match_in_text(cleaned)
    if match2:
        _, enum, _, _ = match2
        return enum

    raise SystemExit(f"Unknown fall_2023_attribute value (not mappable to bucket): {raw!r}")

def main():
    if not os.path.exists(CSV_PATH):
        raise SystemExit(f"CSV not found at: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)

    required_cols = {"course", "title", "fall_2023_attribute"}
    missing = required_cols - set(df.columns)
    if missing:
        raise SystemExit(f"CSV is missing columns: {sorted(missing)}")

    df["course"] = df["course"].astype(str).map(normalize_whitespace)
    df["title"] = df["title"].astype(str).map(normalize_whitespace)

    df["attribute"] = df.apply(map_attribute, axis=1)

    rows = []
    for _, r in df.iterrows():
        subject = parse_subject(r["course"])
        title = normalize_whitespace(str(r["title"]))
        attr = r["attribute"]

        rows.append(
            {
                "code": subject,
                "name": title,
                "credits": 3,  # default for gen-ed list
                "attribute": attr,
            }
        )

    # De-dupe by (code, name)
    seen = set()
    deduped = []
    for x in rows:
        k = (x["code"], x["name"])
        if k not in seen:
            seen.add(k)
            deduped.append(x)

    # Upsert into Supabase (requires unique index on (code,name))
    url = f"{SUPABASE_URL}/rest/v1/courses?on_conflict=code,name"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    chunk_size = 200
    for i in range(0, len(deduped), chunk_size):
        chunk = deduped[i : i + chunk_size]
        resp = requests.post(url, headers=headers, json=chunk, timeout=60)
        if resp.status_code >= 300:
            raise SystemExit(f"Supabase error {resp.status_code}: {resp.text}")
        print(f"Upserted chunk {i//chunk_size + 1}: {len(chunk)} rows")

    print(f"Done. Upserted {len(deduped)} unique (code,name) rows.")

if __name__ == "__main__":
    main()