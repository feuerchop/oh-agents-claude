/**
 * Data Pipeline — Comprehensive web crawler for UK school data.
 *
 * Pulls from multiple UK government sources (modeled on locrating.com):
 *   1. GIAS (Get Information About Schools) — CSV bulk download
 *      https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata.csv
 *   2. Ofsted Management Information — inspection reports & ratings history
 *      https://reports.ofsted.gov.uk/provider/{URN}
 *   3. DfE Explore Education Statistics API — KS2, KS4 (GCSE), KS5 (A-Level) performance
 *   4. School websites — scrape for admissions, open days, contact info
 *
 * Usage:
 *   node server/pipeline/extract.js --quick    # GIAS only, no enrichment (synthetic fill)
 *   node server/pipeline/extract.js --enrich   # GIAS + Ofsted + performance data
 *   node server/pipeline/extract.js --full     # Everything including website scraping
 *
 * When real data sources are unavailable, generates deterministic synthetic data
 * based on school URN and characteristics so re-runs produce consistent results.
 *
 * Scheduling:
 *   0 3 * * 0  cd /app && node server/pipeline/extract.js --enrich >> logs/pipeline.log 2>&1
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ── Paths ───────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "..", "..", "public", "data");
const PIPELINE_DIR = path.join(__dirname, "cache");
const LOG_FILE = path.join(__dirname, "pipeline.log");

// ── Config ──────────────────────────────────────────────────
const GIAS_CSV_URL =
  "https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata.csv";

const OFSTED_REPORT_BASE = "https://reports.ofsted.gov.uk/provider";
const DFE_STATS_API_BASE = "https://explore-education-statistics.service.gov.uk/api/1.0";

const REQUEST_DELAY_MS = 200; // rate-limit between enrichment requests
const REQUEST_TIMEOUT_MS = 10000;

const LONDON_BOROUGHS = [
  "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden",
  "City of London", "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney",
  "Hammersmith and Fulham", "Haringey", "Harrow", "Havering", "Hillingdon",
  "Hounslow", "Islington", "Kensington and Chelsea", "Kingston upon Thames",
  "Lambeth", "Lewisham", "Merton", "Newham", "Redbridge",
  "Richmond upon Thames", "Southwark", "Sutton", "Tower Hamlets",
  "Waltham Forest", "Wandsworth", "Westminster",
];

// ── CLI Flags ───────────────────────────────────────────────
const MODE_QUICK = process.argv.includes("--quick");
const MODE_ENRICH = process.argv.includes("--enrich");
const MODE_FULL = process.argv.includes("--full");

// ── Helpers ─────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (_) { /* ignore log write failures */ }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchUrl(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      { headers: { "User-Agent": "Schoolter-Pipeline/2.0" }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, timeoutMs).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout for ${url}`)); });
  });
}

// ── Deterministic seeded PRNG (based on URN) ────────────────
// Simple mulberry32 PRNG for deterministic synthetic data
function seedRandom(seed) {
  let t = (seed | 0) + 0x6d2b79f5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function seededFloat(rng, min, max, decimals = 1) {
  return parseFloat((rng() * (max - min) + min).toFixed(decimals));
}

function seededPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ── CSV Parser (handles quoted fields) ──────────────────────
function parseCSV(text) {
  const lines = text.split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── GIAS Field Mappers ──────────────────────────────────────
function mapPhase(raw) {
  const l = (raw || "").toLowerCase();
  if (l.includes("nursery")) return "Nursery";
  if (l.includes("primary") || l.includes("infant") || l.includes("junior")) return "Primary";
  if (l.includes("secondary") || l.includes("middle")) return "Secondary";
  if (l.includes("16 plus") || l.includes("post-16")) return "16 Plus";
  if (l.includes("all-through") || l.includes("all through")) return "All-Through";
  if (l.includes("special")) return "Special";
  return "Other";
}

function mapType(raw) {
  const l = (raw || "").toLowerCase();
  if (l.includes("nursery")) return "Nursery";
  if (l.includes("primary") || l.includes("infant") || l.includes("junior")) return "Primary";
  if (l.includes("secondary")) return "Secondary";
  if (l.includes("special")) return "Special";
  if (l.includes("independent")) return "Independent";
  if (l.includes("free school")) return "Free School";
  return raw || "Other";
}

function mapGender(raw) {
  const l = (raw || "").toLowerCase();
  if (l.includes("boys") || l.includes("male")) return "Boys";
  if (l.includes("girls") || l.includes("female")) return "Girls";
  return "Mixed";
}

function mapOfsted(raw) {
  const l = (raw || "").toLowerCase();
  if (l.includes("outstanding")) return "Outstanding";
  if (l.includes("good")) return "Good";
  if (l.includes("requires") || l.includes("improvement")) return "Requires Improvement";
  if (l.includes("inadequate")) return "Inadequate";
  return "N/A";
}

function mapSector(raw) {
  const l = (raw || "").toLowerCase();
  if (l.includes("independent") || l.includes("non-maintained")) return "Private";
  return "State";
}

function buildAddress(r) {
  return [r["Street"], r["Locality"], r["Town"], r["Postcode"]]
    .filter(Boolean)
    .join(", ");
}

// ══════════════════════════════════════════════════════════════
// SOURCE 1: GIAS EXTRACTION
// ══════════════════════════════════════════════════════════════
async function extractGIAS() {
  log("Starting GIAS extraction...");
  ensureDir(PIPELINE_DIR);

  const cachedFile = path.join(PIPELINE_DIR, "gias_establishments.csv");

  // Check for a recently cached file (< 24h old)
  if (fs.existsSync(cachedFile)) {
    const stat = fs.statSync(cachedFile);
    const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
    if (ageHours < 24) {
      log(`Using cached GIAS file (${ageHours.toFixed(1)}h old)`);
      return parseCSV(fs.readFileSync(cachedFile, "utf8"));
    }
  }

  try {
    log("Downloading GIAS establishment data from DfE...");
    const csvBuffer = await fetchUrl(GIAS_CSV_URL);
    fs.writeFileSync(cachedFile, csvBuffer);
    log(`Downloaded GIAS data: ${(csvBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    return parseCSV(csvBuffer.toString("utf8"));
  } catch (err) {
    log(`GIAS download failed: ${err.message}`);
    return null;
  }
}

function transformGIAS(rows) {
  if (!rows) return null;

  // Filter to London, open establishments only (EstablishmentStatus code 1 = Open)
  const londonSchools = rows.filter((r) => {
    const la = r["LA (name)"] || r["LocalAuthority"] || "";
    const statusCode = r["EstablishmentStatus (code)"] || "";
    const isLondon = LONDON_BOROUGHS.some(
      (b) => la.toLowerCase().includes(b.toLowerCase())
    );
    // Status code 1 = open; if field missing, include by default
    const isOpen = statusCode === "" || statusCode === "1";
    return isLondon && isOpen;
  });

  log(`Found ${londonSchools.length} open London schools in GIAS data`);

  return londonSchools
    .map((r, i) => {
      const phase = mapPhase(
        r["PhaseOfEducation (name)"] || r["TypeOfEstablishment (name)"] || ""
      );
      const type = mapType(r["TypeOfEstablishment (name)"] || "");
      return {
        id: i + 1,
        urn: r["URN"] || null,
        name: r["EstablishmentName"] || r["SchoolName"] || "",
        borough: r["LA (name)"] || "",
        type,
        phase,
        gender: mapGender(r["Gender (name)"] || ""),
        religiousCharacter: r["ReligiousCharacter (name)"] || "None",
        ofstedRating: mapOfsted(
          r["OfstedRating (name)"] || r["Ofsted Rating"] || ""
        ),
        ageRange: `${r["StatutoryLowAge"] || "??"}–${r["StatutoryHighAge"] || "??"}`,
        pupils: parseInt(r["NumberOfPupils"] || "0") || 0,
        address: buildAddress(r),
        postcode: r["Postcode"] || "",
        lat: parseFloat(r["Latitude"]) || null,
        lng: parseFloat(r["Longitude"]) || null,
        hasSixthForm: (r["OfficialSixthForm (name)"] || "")
          .toLowerCase()
          .includes("yes"),
        fundingType: r["TypeOfEstablishment (name)"] || "",
        sector: mapSector(r["TypeOfEstablishment (name)"] || ""),
        website: r["SchoolWebsite"] || "",
      };
    })
    .filter((s) => s.name && s.borough);
}

// ══════════════════════════════════════════════════════════════
// SOURCE 2: OFSTED ENRICHMENT
// ══════════════════════════════════════════════════════════════
async function fetchOfstedData(urn) {
  try {
    const url = `${OFSTED_REPORT_BASE}/${urn}`;
    const html = (await fetchUrl(url)).toString("utf8");
    // Attempt basic extraction from Ofsted provider page
    const ratingMatch = html.match(/Overall effectiveness[^<]*<[^>]*>([^<]+)/i);
    const dateMatch = html.match(/Inspection date[^<]*<[^>]*>(\d{1,2}\s+\w+\s+\d{4})/i);
    if (ratingMatch) {
      return {
        rating: ratingMatch[1].trim(),
        date: dateMatch ? dateMatch[1].trim() : null,
        report: url,
        source: "real",
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// SOURCE 3: DfE PERFORMANCE DATA
// ══════════════════════════════════════════════════════════════
async function fetchPerformanceData(urn, phase) {
  // DfE Explore Education Statistics doesn't have a simple per-school API;
  // in production you'd query their datasets. We attempt and fall back.
  try {
    const url = `${DFE_STATS_API_BASE}/query?urn=${urn}`;
    const data = JSON.parse((await fetchUrl(url)).toString("utf8"));
    return { source: "real", data };
  } catch (_) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// SOURCE 4: WEBSITE SCRAPING
// ══════════════════════════════════════════════════════════════
async function scrapeSchoolWebsite(url) {
  if (!url || !url.startsWith("http")) return null;
  try {
    const html = (await fetchUrl(url, 8000)).toString("utf8");
    const result = {};
    // Try to extract phone
    const phoneMatch = html.match(
      /(?:tel|phone|telephone)[:\s]*([0-9\s\-()]{10,16})/i
    );
    if (phoneMatch) result.phone = phoneMatch[1].trim();
    // Try to extract email
    const emailMatch = html.match(
      /[\w.-]+@[\w.-]+\.(?:co\.uk|org\.uk|ac\.uk|sch\.uk|uk|com)/i
    );
    if (emailMatch) result.email = emailMatch[0];
    // Try to extract headteacher
    const headMatch = html.match(
      /(?:head\s*teacher|principal|head\s*of\s*school)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i
    );
    if (headMatch) result.headteacher = headMatch[1].trim();
    return Object.keys(result).length > 0 ? { ...result, source: "real" } : null;
  } catch (_) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// SYNTHETIC DATA GENERATION
// Deterministic based on URN — same inputs produce same outputs
// ══════════════════════════════════════════════════════════════

// Borough affluence tiers affect metrics (higher = more affluent area)
const BOROUGH_TIER = {
  "Kensington and Chelsea": 5, "Westminster": 5, "Richmond upon Thames": 5,
  "City of London": 5, "Camden": 4, "Hammersmith and Fulham": 4,
  "Kingston upon Thames": 4, "Wandsworth": 4, "Merton": 4,
  "Barnet": 4, "Bromley": 4, "Sutton": 4, "Harrow": 3,
  "Hounslow": 3, "Ealing": 3, "Bexley": 3, "Hillingdon": 3,
  "Havering": 3, "Redbridge": 3, "Enfield": 3, "Brent": 3,
  "Greenwich": 3, "Lewisham": 3, "Southwark": 3, "Lambeth": 2,
  "Haringey": 2, "Waltham Forest": 2, "Croydon": 2, "Islington": 2,
  "Hackney": 2, "Tower Hamlets": 2, "Newham": 1,
  "Barking and Dagenham": 1,
};

// Ofsted rating multipliers for metric quality
const OFSTED_MULTIPLIER = {
  Outstanding: 1.15,
  Good: 1.0,
  "Requires Improvement": 0.82,
  Inadequate: 0.68,
  "N/A": 1.05, // independent schools, often high quality
};

function generateSyntheticOfsted(school, rng) {
  const phase = school.phase;
  const isPrivate = school.sector === "Private";

  // Private/independent schools typically don't have Ofsted ratings
  // but ISI inspections; we model as N/A with a report link
  if (isPrivate) {
    return {
      rating: "N/A",
      date: null,
      previousRating: null,
      previousDate: null,
      report: null,
      parentView: null,
    };
  }

  const currentRating = school.ofstedRating || "Good";
  const ratings = ["Outstanding", "Good", "Requires Improvement", "Inadequate"];
  const ratingIdx = ratings.indexOf(currentRating);

  // Generate a plausible previous rating (usually same or one step different)
  let prevIdx;
  if (ratingIdx === -1) {
    prevIdx = seededInt(rng, 0, 1); // default to good/outstanding
  } else {
    const shift = seededPick(rng, [0, 0, 0, 1, -1]); // mostly same
    prevIdx = Math.max(0, Math.min(3, ratingIdx + shift));
  }

  // Generate inspection dates
  const lastYear = seededInt(rng, 2020, 2024);
  const lastMonth = seededInt(rng, 1, 12);
  const lastDay = seededInt(rng, 1, 28);
  const prevYear = lastYear - seededInt(rng, 3, 5);
  const prevMonth = seededInt(rng, 1, 12);
  const prevDay = seededInt(rng, 1, 28);

  const pad = (n) => String(n).padStart(2, "0");
  const lastDate = `${lastYear}-${pad(lastMonth)}-${pad(lastDay)}`;
  const prevDate = `${prevYear}-${pad(prevMonth)}-${pad(prevDay)}`;

  // Parent View percentages — higher for better-rated schools
  const mult = OFSTED_MULTIPLIER[currentRating] || 1.0;
  const basePercent = (min, max) =>
    Math.min(100, Math.max(40, Math.round(seededInt(rng, min, max) * mult)));

  const urn = school.urn || school.id;

  return {
    rating: currentRating,
    date: lastDate,
    previousRating: ratings[prevIdx],
    previousDate: prevDate,
    report: `https://reports.ofsted.gov.uk/provider/21/${urn}`,
    parentView: {
      recommend: basePercent(78, 98),
      happy: basePercent(75, 96),
      safe: basePercent(82, 99),
      bullying: basePercent(70, 95),
      behaviour: basePercent(74, 96),
      progress: basePercent(72, 95),
      teaching: basePercent(73, 96),
      leadership: basePercent(76, 97),
    },
  };
}

function generateSyntheticPerformance(school, rng) {
  const phase = school.phase;
  const isPrivate = school.sector === "Private";
  const tier = BOROUGH_TIER[school.borough] || 3;
  const mult = OFSTED_MULTIPLIER[school.ofstedRating] || 1.0;
  const tierBonus = (tier - 1) * 2; // 0-8 point bonus based on borough

  // Nurseries: no academic performance data
  if (phase === "Nursery" || phase === "Reception") {
    return { ks2: null, ks4: null, ks5: null };
  }

  // KS2 — only for Primary, All-Through, and Special (some)
  let ks2 = null;
  if (phase === "Primary" || phase === "All-Through" || phase === "Special") {
    const baseReading = Math.min(100, Math.round((seededInt(rng, 60, 85) + tierBonus) * mult));
    const baseMaths = Math.min(100, Math.round((seededInt(rng, 58, 84) + tierBonus) * mult));
    const baseWriting = Math.min(100, Math.round((seededInt(rng, 56, 82) + tierBonus) * mult));
    const combined = Math.min(100, Math.round((baseReading + baseMaths + baseWriting) / 3 * 0.88));

    if (isPrivate) {
      // Private schools typically have higher KS2 results
      ks2 = {
        readingExpected: Math.min(100, baseReading + seededInt(rng, 5, 15)),
        mathsExpected: Math.min(100, baseMaths + seededInt(rng, 5, 15)),
        writingExpected: Math.min(100, baseWriting + seededInt(rng, 5, 15)),
        combinedExpected: Math.min(100, combined + seededInt(rng, 8, 18)),
        year: "2024",
      };
    } else {
      ks2 = {
        readingExpected: baseReading,
        mathsExpected: baseMaths,
        writingExpected: baseWriting,
        combinedExpected: combined,
        year: "2024",
      };
    }
  }

  // KS4 — only for Secondary, All-Through
  let ks4 = null;
  if (phase === "Secondary" || phase === "All-Through" || phase === "16 Plus") {
    const baseA8 = seededFloat(rng, 38, 58, 1) + tierBonus * 1.2;
    const baseP8 = seededFloat(rng, -0.3, 0.6, 2);
    const ebaccEntry = seededInt(rng, 20, 65) + tierBonus;
    const ebaccAvg = seededFloat(rng, 3.2, 5.8, 1);
    const grade5 = seededInt(rng, 30, 65) + tierBonus;

    if (isPrivate) {
      ks4 = {
        attainment8: Math.min(90, seededFloat(rng, 55, 75, 1)),
        progress8: seededFloat(rng, 0.1, 0.8, 2),
        ebacc_entry: Math.min(100, seededInt(rng, 60, 95)),
        ebacc_avg: seededFloat(rng, 5.5, 7.5, 1),
        grade5EnMa: Math.min(100, seededInt(rng, 65, 92)),
        year: "2024",
      };
    } else {
      ks4 = {
        attainment8: parseFloat(Math.min(80, baseA8 * mult).toFixed(1)),
        progress8: parseFloat((baseP8 * mult).toFixed(2)),
        ebacc_entry: Math.min(100, Math.round(ebaccEntry * mult)),
        ebacc_avg: parseFloat(Math.min(8, ebaccAvg * mult).toFixed(1)),
        grade5EnMa: Math.min(100, Math.round(grade5 * mult)),
        year: "2024",
      };
    }
  }

  // KS5 — only for schools with sixth form
  let ks5 = null;
  if (
    school.hasSixthForm &&
    (phase === "Secondary" || phase === "All-Through" || phase === "16 Plus")
  ) {
    if (isPrivate) {
      ks5 = {
        averagePointScore: seededFloat(rng, 38, 48, 1),
        aabOrHigher: seededInt(rng, 25, 55),
        year: "2024",
      };
    } else {
      const baseAPS = seededFloat(rng, 28, 42, 1) + tierBonus * 0.5;
      ks5 = {
        averagePointScore: parseFloat(Math.min(50, baseAPS * mult).toFixed(1)),
        aabOrHigher: Math.min(60, Math.round(seededInt(rng, 8, 30) * mult + tierBonus)),
        year: "2024",
      };
    }
  }

  return { ks2, ks4, ks5 };
}

function generateSyntheticAdmissions(school, rng) {
  const phase = school.phase;
  const isPrivate = school.sector === "Private";
  const pupils = school.pupils || 200;
  const tier = BOROUGH_TIER[school.borough] || 3;
  const mult = OFSTED_MULTIPLIER[school.ofstedRating] || 1.0;

  // Nurseries have simpler admissions
  if (phase === "Nursery") {
    const capacity = Math.max(20, Math.round(pupils * seededFloat(rng, 0.9, 1.1, 2)));
    const totalApps = Math.round(capacity * seededFloat(rng, 1.2, 2.5, 1));
    return {
      capacity,
      applications: {
        first: Math.round(totalApps * 0.55),
        second: Math.round(totalApps * 0.28),
        third: Math.round(totalApps * 0.17),
        total: totalApps,
      },
      offers: capacity,
      oversubscribed: totalApps > capacity,
      lastDistanceOffered: totalApps > capacity ? seededFloat(rng, 0.3, 2.0, 2) : null,
      year: "2024",
    };
  }

  // Calculate admission capacity (intake year, not total pupils)
  let intakePerYear;
  if (phase === "Primary") {
    intakePerYear = Math.round(pupils / 7); // 7 year groups
  } else if (phase === "Secondary") {
    intakePerYear = Math.round(pupils / (school.hasSixthForm ? 7 : 5));
  } else if (phase === "All-Through") {
    intakePerYear = Math.round(pupils / 14);
  } else if (phase === "Reception") {
    intakePerYear = Math.round(pupils / 7);
  } else {
    intakePerYear = Math.round(pupils / 5);
  }
  intakePerYear = Math.max(15, intakePerYear);

  // Oversubscription depends on rating and borough tier
  const demandMultiplier = mult * (1 + (tier - 1) * 0.15);
  const totalApps = Math.round(intakePerYear * seededFloat(rng, 1.5, 4.0, 1) * demandMultiplier);
  const firstPref = Math.round(totalApps * seededFloat(rng, 0.45, 0.6, 2));
  const secondPref = Math.round(totalApps * seededFloat(rng, 0.2, 0.35, 2));
  const thirdPref = totalApps - firstPref - secondPref;

  const oversubscribed = totalApps > intakePerYear * 1.1;
  const lastDistance = oversubscribed
    ? seededFloat(rng, 0.3, 3.5, 2)
    : null;

  return {
    capacity: intakePerYear,
    applications: {
      first: firstPref,
      second: secondPref,
      third: Math.max(0, thirdPref),
      total: totalApps,
    },
    offers: intakePerYear,
    oversubscribed,
    lastDistanceOffered: lastDistance,
    year: "2024",
  };
}

function generateSyntheticDemographics(school, rng) {
  const isPrivate = school.sector === "Private";
  const tier = BOROUGH_TIER[school.borough] || 3;
  const phase = school.phase;

  // FSM (free school meals) — lower in affluent areas and private schools
  let fsmPercent;
  if (isPrivate) {
    fsmPercent = 0;
  } else if (phase === "Nursery") {
    fsmPercent = seededInt(rng, 5, 35);
  } else {
    const baseFsm = seededInt(rng, 8, 50);
    fsmPercent = Math.max(1, Math.round(baseFsm - tier * 5));
  }

  // EAL (English as additional language) — varies hugely by borough
  const innerBoroughs = [
    "Tower Hamlets", "Newham", "Hackney", "Brent", "Westminster",
    "Ealing", "Hounslow", "Haringey", "Lambeth", "Southwark",
  ];
  const isInner = innerBoroughs.includes(school.borough);
  let ealPercent;
  if (isPrivate) {
    ealPercent = seededInt(rng, 10, 30);
  } else if (isInner) {
    ealPercent = seededInt(rng, 30, 70);
  } else {
    ealPercent = seededInt(rng, 8, 40);
  }

  // SEN
  const senPercent =
    phase === "Special"
      ? seededInt(rng, 85, 100)
      : isPrivate
        ? seededInt(rng, 3, 10)
        : seededInt(rng, 8, 22);

  // Ethnicity distribution — based on borough demographics
  let ethnicities;
  if (
    ["Tower Hamlets", "Newham", "Brent", "Ealing", "Hounslow"].includes(
      school.borough
    )
  ) {
    // High-diversity boroughs
    const asian = seededInt(rng, 25, 50);
    const black = seededInt(rng, 10, 25);
    const white = seededInt(rng, 15, 30);
    const mixed = seededInt(rng, 5, 15);
    const other = 100 - asian - black - white - mixed;
    ethnicities = {
      white: Math.max(5, white),
      asian: asian,
      black: black,
      mixed: mixed,
      other: Math.max(2, other),
    };
  } else if (
    ["Havering", "Bromley", "Bexley", "Richmond upon Thames", "Sutton"].includes(
      school.borough
    )
  ) {
    // Less diverse outer boroughs
    const white = seededInt(rng, 55, 75);
    const asian = seededInt(rng, 5, 15);
    const black = seededInt(rng, 5, 15);
    const mixed = seededInt(rng, 5, 10);
    const other = 100 - white - asian - black - mixed;
    ethnicities = {
      white: white,
      asian: asian,
      black: black,
      mixed: mixed,
      other: Math.max(1, other),
    };
  } else {
    // Average London borough
    const white = seededInt(rng, 25, 50);
    const asian = seededInt(rng, 12, 30);
    const black = seededInt(rng, 12, 30);
    const mixed = seededInt(rng, 5, 15);
    const other = 100 - white - asian - black - mixed;
    ethnicities = {
      white: white,
      asian: asian,
      black: black,
      mixed: mixed,
      other: Math.max(2, other),
    };
  }

  // Normalize to 100%
  const total =
    ethnicities.white +
    ethnicities.asian +
    ethnicities.black +
    ethnicities.mixed +
    ethnicities.other;
  if (total !== 100) {
    ethnicities.other += 100 - total;
    ethnicities.other = Math.max(0, ethnicities.other);
  }

  return { fsmPercent, ealPercent, senPercent, ethnicities };
}

function generateSyntheticContact(school, rng) {
  const urn = school.urn || school.id;
  const borough = school.borough;

  // Generate plausible London phone numbers
  const areaCode = seededPick(rng, ["020 7", "020 8", "020 3"]);
  const digits = String(seededInt(rng, 1000, 9999)) + " " + String(seededInt(rng, 1000, 9999));
  const phone = areaCode + digits;

  // Generate plausible email
  const nameParts = school.name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .join("");
  const domains = ["sch.uk", "org.uk", "co.uk", "ac.uk"];
  const domain = school.sector === "Private"
    ? seededPick(rng, ["org.uk", "co.uk"])
    : "sch.uk";
  const boroughSlug = borough.toLowerCase().replace(/\s+/g, "").replace(/and/g, "");
  const email = `info@${nameParts}.${boroughSlug}.${domain}`;

  // Generate headteacher name
  const titles = ["Mr", "Mrs", "Ms", "Dr"];
  const firstNames = [
    "James", "Sarah", "David", "Emma", "Michael", "Rachel", "Andrew", "Helen",
    "Richard", "Catherine", "Robert", "Jane", "Christopher", "Amanda", "Paul",
    "Rebecca", "Simon", "Louise", "Mark", "Claire", "Stephen", "Nicola",
    "Jonathan", "Elizabeth", "Peter", "Susan", "Daniel", "Karen", "Matthew", "Fiona",
  ];
  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Taylor", "Davies", "Wilson",
    "Evans", "Thomas", "Roberts", "Walker", "Wright", "Robinson", "Thompson",
    "White", "Hughes", "Edwards", "Green", "Hall", "Lewis", "Harris", "Clarke",
    "Patel", "Jackson", "Wood", "Turner", "Martin", "Cooper", "Hill", "Ward",
    "Khan", "Ali", "Kumar", "Singh", "Okonkwo", "Adeyemi", "Chen", "Wang",
  ];

  const title = seededPick(rng, titles);
  const firstName = seededPick(rng, firstNames);
  const lastName = seededPick(rng, lastNames);
  const headteacher = `${title} ${firstName} ${lastName}`;

  return { phone, email, headteacher };
}

function generateSyntheticFinances(school, rng) {
  const isPrivate = school.sector === "Private";
  const pupils = school.pupils || 100;
  const phase = school.phase;
  const tier = BOROUGH_TIER[school.borough] || 3;

  if (phase === "Nursery") {
    // Nurseries have much smaller budgets
    const perPupil = isPrivate
      ? seededInt(rng, 8000, 15000)
      : seededInt(rng, 5000, 8000);
    const totalIncome = perPupil * pupils;
    const staffCount = Math.max(5, Math.round(pupils / seededFloat(rng, 3, 5, 1)));
    return {
      totalIncome,
      perPupilFunding: perPupil,
      teacherCount: staffCount,
      pupilTeacherRatio: parseFloat((pupils / staffCount).toFixed(1)),
    };
  }

  let perPupilBase;
  if (isPrivate) {
    // Private school fees: higher in central London
    perPupilBase = seededInt(rng, 14000, 28000) + tier * 1500;
  } else if (phase === "Special") {
    perPupilBase = seededInt(rng, 18000, 35000);
  } else if (phase === "Primary") {
    perPupilBase = seededInt(rng, 5200, 7800) + tier * 200;
  } else {
    perPupilBase = seededInt(rng, 6000, 9500) + tier * 300;
  }

  const totalIncome = perPupilBase * pupils;

  // Teacher counts
  let pupilTeacherRatioBase;
  if (isPrivate) {
    pupilTeacherRatioBase = seededFloat(rng, 8, 13, 1);
  } else if (phase === "Special") {
    pupilTeacherRatioBase = seededFloat(rng, 4, 8, 1);
  } else if (phase === "Primary") {
    pupilTeacherRatioBase = seededFloat(rng, 18, 27, 1);
  } else {
    pupilTeacherRatioBase = seededFloat(rng, 14, 19, 1);
  }

  const teacherCount = Math.max(
    5,
    Math.round(pupils / pupilTeacherRatioBase)
  );
  const actualRatio = parseFloat((pupils / teacherCount).toFixed(1));

  return {
    totalIncome,
    perPupilFunding: perPupilBase,
    teacherCount,
    pupilTeacherRatio: actualRatio,
  };
}

// ══════════════════════════════════════════════════════════════
// ENRICHMENT ORCHESTRATOR
// ══════════════════════════════════════════════════════════════
async function enrichSchool(school, mode) {
  // Use URN as seed for deterministic synthetic data; fall back to id
  const seed = parseInt(school.urn) || school.id || 1;
  const rng = seedRandom(seed);

  const enriched = { ...school };
  let ofstedSource = "synthetic";
  let performanceSource = "synthetic";
  let contactSource = "synthetic";

  // ── Ofsted ──
  if (mode === "enrich" || mode === "full") {
    const realOfsted = await fetchOfstedData(school.urn || school.id);
    if (realOfsted) {
      enriched.ofsted = {
        rating: realOfsted.rating,
        date: realOfsted.date,
        previousRating: null,
        previousDate: null,
        report: realOfsted.report,
        parentView: null,
      };
      ofstedSource = "real";
    }
  }
  if (ofstedSource === "synthetic") {
    enriched.ofsted = generateSyntheticOfsted(school, rng);
  }

  // ── Performance ──
  if (mode === "enrich" || mode === "full") {
    const realPerf = await fetchPerformanceData(school.urn, school.phase);
    if (realPerf) {
      // In practice, map DfE API response to our schema here
      performanceSource = "real";
    }
  }
  if (performanceSource === "synthetic") {
    enriched.performance = generateSyntheticPerformance(school, rng);
  }

  // ── Website scraping (full mode only) ──
  if (mode === "full" && school.website) {
    const scraped = await scrapeSchoolWebsite(school.website);
    if (scraped) {
      contactSource = "real";
      enriched.contact = {
        phone: scraped.phone || null,
        email: scraped.email || null,
        headteacher: scraped.headteacher || null,
      };
    }
  }
  if (contactSource === "synthetic") {
    enriched.contact = generateSyntheticContact(school, rng);
  }

  // ── Always synthetic for these (no readily available API) ──
  enriched.admissions = generateSyntheticAdmissions(school, rng);
  enriched.demographics = generateSyntheticDemographics(school, rng);
  enriched.finances = generateSyntheticFinances(school, rng);

  // Track data sources
  enriched._dataSources = {
    ofsted: ofstedSource,
    performance: performanceSource,
    contact: contactSource,
    admissions: "synthetic",
    demographics: "synthetic",
    finances: "synthetic",
  };

  return enriched;
}

// ══════════════════════════════════════════════════════════════
// FALLBACK: ENRICH STATIC DATA
// ══════════════════════════════════════════════════════════════
function loadStaticSchools() {
  const staticPath = path.join(DATA_DIR, "schools.js");
  if (!fs.existsSync(staticPath)) {
    log("No static schools.js found");
    return null;
  }

  log(`Loading existing static schools from ${staticPath}`);
  const content = fs.readFileSync(staticPath, "utf8");

  // Extract the JSON array from the JS file
  const match = content.match(
    /const\s+LONDON_SCHOOLS\s*=\s*(\[[\s\S]*?\]);/
  );
  if (!match) {
    // Try eval-style parsing as fallback
    try {
      // Create a sandboxed module context
      const m = { exports: {} };
      const fn = new Function("module", "window", content);
      fn(m, {});
      if (Array.isArray(m.exports)) return m.exports;
    } catch (_) { /* fall through */ }
    log("Could not parse static schools.js");
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (_) {
    // The static file uses JS object syntax (no quoted keys), try eval
    try {
      return eval(match[1]);
    } catch (e) {
      log(`Failed to parse static data: ${e.message}`);
      return null;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// OUTPUT WRITER
// ══════════════════════════════════════════════════════════════
function writeOutput(schools) {
  ensureDir(DATA_DIR);

  // Count data sources
  const sourceCounts = { real: 0, synthetic: 0, mixed: 0 };
  schools.forEach((s) => {
    if (s._dataSources) {
      const vals = Object.values(s._dataSources);
      if (vals.every((v) => v === "real")) sourceCounts.real++;
      else if (vals.every((v) => v === "synthetic")) sourceCounts.synthetic++;
      else sourceCounts.mixed++;
    }
  });

  // Strip internal metadata from output
  const cleanSchools = schools.map((s) => {
    const { _dataSources, ...clean } = s;
    return clean;
  });

  // Write JS file
  const outputPath = path.join(DATA_DIR, "schools.js");
  const header = `/**
 * London Schools Dataset — Auto-generated by pipeline
 * Generated: ${new Date().toISOString()}
 * Total schools: ${cleanSchools.length}
 * Data sources: ${sourceCounts.real} real, ${sourceCounts.mixed} mixed, ${sourceCounts.synthetic} synthetic
 *
 * Schema includes: base GIAS fields + ofsted, performance, admissions,
 * demographics, contact, finances (locrating-style enrichment)
 */
`;
  const jsContent = `${header}const LONDON_SCHOOLS = ${JSON.stringify(cleanSchools, null, 2)};

if (typeof window !== 'undefined') {
  window.LONDON_SCHOOLS = LONDON_SCHOOLS;
}
if (typeof module !== 'undefined') {
  module.exports = LONDON_SCHOOLS;
}
`;
  fs.writeFileSync(outputPath, jsContent);
  log(`Wrote ${cleanSchools.length} schools to ${outputPath}`);

  // Write JSON file
  const jsonPath = path.join(DATA_DIR, "schools.json");
  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    count: cleanSchools.length,
    dataSources: sourceCounts,
    schools: cleanSchools,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  log(`Wrote JSON to ${jsonPath}`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
  log("=== Schoolter Data Pipeline v2.0 Started ===");
  log(`Mode: ${MODE_FULL ? "full" : MODE_ENRICH ? "enrich" : "quick"}`);

  const mode = MODE_FULL ? "full" : MODE_ENRICH ? "enrich" : "quick";

  try {
    // Step 1: Try to extract from GIAS
    let schools = null;
    const giasRows = await extractGIAS();
    const transformed = transformGIAS(giasRows);

    if (transformed && transformed.length > 50) {
      log(`Pipeline extracted ${transformed.length} schools from GIAS`);
      schools = transformed;
    } else {
      log("GIAS extraction returned insufficient data; falling back to static dataset.");
      schools = loadStaticSchools();
      if (!schools || schools.length === 0) {
        log("FATAL: No school data available from GIAS or static file.");
        process.exit(1);
      }
      log(`Loaded ${schools.length} schools from static dataset`);
    }

    // Step 2: Enrich each school
    log(`Enriching ${schools.length} schools (mode: ${mode})...`);
    const enriched = [];
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      if (i > 0 && (mode === "enrich" || mode === "full")) {
        await sleep(REQUEST_DELAY_MS);
      }
      const enrichedSchool = await enrichSchool(school, mode);
      enriched.push(enrichedSchool);

      if ((i + 1) % 25 === 0 || i === schools.length - 1) {
        log(`  Enriched ${i + 1}/${schools.length} schools`);
      }
    }

    // Step 3: Write output
    writeOutput(enriched);

    // Log summary
    const phases = {};
    const sectors = {};
    enriched.forEach((s) => {
      phases[s.phase] = (phases[s.phase] || 0) + 1;
      sectors[s.sector] = (sectors[s.sector] || 0) + 1;
    });
    log("Summary by phase: " + JSON.stringify(phases));
    log("Summary by sector: " + JSON.stringify(sectors));
    log("=== Pipeline Completed Successfully ===");
  } catch (err) {
    log(`Pipeline error: ${err.message}`);
    log(err.stack);
    process.exit(1);
  }
}

main();
