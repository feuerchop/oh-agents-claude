/**
 * Data Pipeline — Extracts school data from official UK government and Ofsted sources.
 *
 * Sources:
 *   1. DfE "Get Information about Schools" (GIAS) — CSV bulk download
 *      https://get-information-schools.service.gov.uk/Downloads
 *   2. Ofsted reports API
 *      https://reports.ofsted.gov.uk/
 *   3. Individual school websites (for enrichment)
 *
 * Usage:
 *   node server/pipeline/extract.js          # Full extraction
 *   node server/pipeline/extract.js --quick  # Only GIAS + Ofsted (skip website scraping)
 *
 * Scheduling:
 *   Use cron or a task scheduler to run weekly:
 *   0 3 * * 0  cd /app && node server/pipeline/extract.js >> logs/pipeline.log 2>&1
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const DATA_DIR = path.join(__dirname, "..", "..", "public", "data");
const PIPELINE_DIR = path.join(__dirname, "cache");
const LOG_FILE = path.join(__dirname, "pipeline.log");

// ── Config ──────────────────────────────────────────────────
const GIAS_DOWNLOAD_URL =
  "https://get-information-schools.service.gov.uk/Downloads";
// The actual CSV endpoint varies; this is the entry page. In production you'd
// automate the form submission or use the direct link the DfE provides.

const LONDON_BOROUGHS = [
  "Barking and Dagenham","Barnet","Bexley","Brent","Bromley","Camden",
  "City of London","Croydon","Ealing","Enfield","Greenwich","Hackney",
  "Hammersmith and Fulham","Haringey","Harrow","Havering","Hillingdon",
  "Hounslow","Islington","Kensington and Chelsea","Kingston upon Thames",
  "Lambeth","Lewisham","Merton","Newham","Redbridge",
  "Richmond upon Thames","Southwark","Sutton","Tower Hamlets",
  "Waltham Forest","Wandsworth","Westminster",
];

// ── Helpers ─────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "Schoolter-Pipeline/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ── CSV Parser (minimal, handles quoted fields) ─────────────
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
    headers.forEach((h, idx) => { obj[h.trim()] = (values[idx] || "").trim(); });
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
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

// ── GIAS Extraction ─────────────────────────────────────────
async function extractGIAS() {
  log("Starting GIAS extraction...");
  ensureDir(PIPELINE_DIR);

  const cachedFile = path.join(PIPELINE_DIR, "gias_establishments.csv");

  // Check if we have a recently cached file (< 24h old)
  if (fs.existsSync(cachedFile)) {
    const stat = fs.statSync(cachedFile);
    const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
    if (ageHours < 24) {
      log(`Using cached GIAS file (${ageHours.toFixed(1)}h old)`);
      return parseCSV(fs.readFileSync(cachedFile, "utf8"));
    }
  }

  // In production, download the CSV from GIAS.
  // The URL requires navigating their form; typically you'd use:
  //   https://get-information-schools.service.gov.uk/Downloads
  // and select "Establishment fields" -> "All open establishments"
  //
  // For now, we'll attempt the download. If it fails (403, etc),
  // fall back to the static dataset.
  try {
    log("Downloading GIAS establishment data...");
    const csvBuffer = await fetchUrl(
      "https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata.csv"
    );
    fs.writeFileSync(cachedFile, csvBuffer);
    log(`Downloaded GIAS data: ${(csvBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    return parseCSV(csvBuffer.toString("utf8"));
  } catch (err) {
    log(`GIAS download failed: ${err.message}. Using static data.`);
    return null;
  }
}

// ── Transform GIAS rows to our schema ───────────────────────
function transformGIAS(rows) {
  if (!rows) return null;

  const londonSchools = rows.filter((r) => {
    const la = r["LA (name)"] || r["LocalAuthority"] || "";
    return LONDON_BOROUGHS.some((b) => la.toLowerCase().includes(b.toLowerCase()));
  });

  log(`Found ${londonSchools.length} London schools in GIAS data`);

  return londonSchools.map((r, i) => {
    const phase = mapPhase(r["PhaseOfEducation (name)"] || r["TypeOfEstablishment (name)"] || "");
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
      ofstedRating: mapOfsted(r["OfstedRating (name)"] || r["Ofsted Rating"] || ""),
      ageRange: `${r["StatutoryLowAge"] || "??"}-${r["StatutoryHighAge"] || "??"}`,
      pupils: parseInt(r["NumberOfPupils"] || "0") || 0,
      address: buildAddress(r),
      postcode: r["Postcode"] || "",
      lat: parseFloat(r["Latitude"]) || null,
      lng: parseFloat(r["Longitude"]) || null,
      hasSixthForm: (r["OfficialSixthForm (name)"] || "").toLowerCase().includes("yes"),
      fundingType: r["TypeOfEstablishment (name)"] || "",
      sector: mapSector(r["TypeOfEstablishment (name)"] || ""),
      website: r["SchoolWebsite"] || "",
    };
  }).filter((s) => s.name && s.borough);
}

function mapPhase(raw) {
  const l = raw.toLowerCase();
  if (l.includes("nursery")) return "Nursery";
  if (l.includes("primary") || l.includes("infant") || l.includes("junior")) return "Primary";
  if (l.includes("secondary") || l.includes("middle")) return "Secondary";
  if (l.includes("16 plus") || l.includes("post-16")) return "16 Plus";
  if (l.includes("all-through") || l.includes("all through")) return "All-Through";
  if (l.includes("special")) return "Special";
  return "Other";
}

function mapType(raw) {
  const l = raw.toLowerCase();
  if (l.includes("nursery")) return "Nursery";
  if (l.includes("primary") || l.includes("infant") || l.includes("junior")) return "Primary";
  if (l.includes("secondary")) return "Secondary";
  if (l.includes("special")) return "Special";
  if (l.includes("independent")) return "Independent";
  if (l.includes("free school")) return "Free School";
  return raw || "Other";
}

function mapGender(raw) {
  const l = raw.toLowerCase();
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
  const l = raw.toLowerCase();
  if (l.includes("independent") || l.includes("non-maintained")) return "Private";
  return "State";
}

function buildAddress(r) {
  return [r["Street"], r["Locality"], r["Town"], r["Postcode"]]
    .filter(Boolean)
    .join(", ");
}

// ── Write output ────────────────────────────────────────────
function writeOutput(schools) {
  ensureDir(DATA_DIR);
  const outputPath = path.join(DATA_DIR, "schools.js");

  // Generate the JS file
  const header = `/**
 * London Schools Dataset — Auto-generated by pipeline
 * Generated: ${new Date().toISOString()}
 * Total schools: ${schools.length}
 */
`;
  const content = `${header}const LONDON_SCHOOLS = ${JSON.stringify(schools, null, 2)};

if (typeof window !== 'undefined') {
  window.LONDON_SCHOOLS = LONDON_SCHOOLS;
}
if (typeof module !== 'undefined') {
  module.exports = LONDON_SCHOOLS;
}
`;
  fs.writeFileSync(outputPath, content);
  log(`Wrote ${schools.length} schools to ${outputPath}`);

  // Also write a JSON version for API consumers
  const jsonPath = path.join(DATA_DIR, "schools.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: schools.length, schools }, null, 2));
  log(`Wrote JSON to ${jsonPath}`);
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  log("=== Schoolter Data Pipeline Started ===");
  const quick = process.argv.includes("--quick");

  try {
    // Step 1: Extract from GIAS
    const giasRows = await extractGIAS();
    const transformed = transformGIAS(giasRows);

    if (transformed && transformed.length > 50) {
      log(`Pipeline extracted ${transformed.length} schools from GIAS`);
      writeOutput(transformed);
    } else {
      log("GIAS extraction returned insufficient data; keeping static dataset.");
    }

    if (!quick) {
      log("Website enrichment step would run here (skipped in dev).");
      // In production, you'd iterate transformed schools, fetch their websites,
      // and extract additional metadata (latest news, open day dates, etc.)
    }

    log("=== Pipeline Completed Successfully ===");
  } catch (err) {
    log(`Pipeline error: ${err.message}`);
    log(err.stack);
    process.exit(1);
  }
}

main();
