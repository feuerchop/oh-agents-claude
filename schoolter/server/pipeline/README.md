# Data Pipeline

Automated extraction pipeline that pulls school data from official UK government sources and enriches it.

## Data Sources

| Source | URL | Data |
|--------|-----|------|
| **GIAS** (Get Information About Schools) | `get-information-schools.service.gov.uk` | All establishment data: name, type, phase, gender, Ofsted, address, URN |
| **EduBase API** | `ea-edubase-api-prod.azurewebsites.net` | Bulk CSV download of all schools in England |
| **Ofsted Reports** | `reports.ofsted.gov.uk` | Latest inspection results and dates |
| **School Websites** | Individual sites | Enrichment: news, open days, additional info |

## How It Works

1. **Extract** — Downloads the GIAS bulk CSV (all open establishments in England)
2. **Filter** — Keeps only London borough schools (all 33 boroughs including City of London)
3. **Transform** — Maps raw DfE fields to our schema, normalises Ofsted ratings, phases, and sectors
4. **Enrich** (optional) — Scrapes individual school websites for extra metadata
5. **Write** — Outputs `public/data/schools.js` and `public/data/schools.json`

## Running

```bash
# Full extraction (includes website enrichment)
node server/pipeline/extract.js

# Quick mode (GIAS + Ofsted only, skips website scraping)
node server/pipeline/extract.js --quick
```

## Scheduling

Add a weekly cron job:

```cron
# Every Sunday at 3am
0 3 * * 0  cd /path/to/schoolter && node server/pipeline/extract.js >> server/pipeline/pipeline.log 2>&1
```

## Schema

Each school record contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique identifier |
| `urn` | string | DfE Unique Reference Number |
| `name` | string | School name |
| `borough` | string | London borough |
| `type` | string | Primary, Secondary, Nursery, Special, etc. |
| `phase` | string | Nursery, Primary, Secondary, Reception, All-Through, Special |
| `gender` | string | Mixed, Boys, Girls |
| `religiousCharacter` | string | None, Church of England, Roman Catholic, etc. |
| `ofstedRating` | string | Outstanding, Good, Requires Improvement, Inadequate, N/A |
| `ageRange` | string | e.g. "11-18", "0-5" |
| `pupils` | number | Number of pupils on roll |
| `address` | string | Full address |
| `postcode` | string | Postcode |
| `lat` / `lng` | number | Coordinates |
| `hasSixthForm` | boolean | Has sixth form provision |
| `fundingType` | string | Academy, Community, Free School, Independent, etc. |
| `sector` | string | State or Private |
| `website` | string | School website URL |

## Caching

Downloaded CSV files are cached in `server/pipeline/cache/` for 24 hours to avoid redundant downloads.
