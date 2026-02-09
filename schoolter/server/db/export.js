/**
 * Database Export — generates schools.js from SQLite database
 * Run: npm run db:export
 */
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "schoolter.db");
const OUTPUT_PATH = path.join(__dirname, "..", "..", "public", "data", "schools.js");
const DOCS_OUTPUT_PATH = path.join(__dirname, "..", "..", "..", "docs", "data", "schools.js");

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error("Database not found. Run: npm run db:init first");
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

// ── Deterministic seeded PRNG (based on URN) ────────────────
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

// ── Borough affluence tiers for realistic data ────────────────
const BOROUGH_TIER = {
  // London affluent
  "Westminster": 1, "Kensington and Chelsea": 1, "Camden": 1, "Richmond upon Thames": 1,
  "Wandsworth": 2, "Hammersmith and Fulham": 2, "Islington": 2, "Southwark": 2, "Lambeth": 2,
  "Barnet": 2, "Bromley": 2, "Kingston upon Thames": 2, "Merton": 2, "Sutton": 2,
  "Greenwich": 3, "Lewisham": 3, "Hackney": 3, "Tower Hamlets": 3, "Newham": 3,
  "Brent": 3, "Ealing": 3, "Haringey": 3, "Hounslow": 3, "Enfield": 3,
  "Redbridge": 3, "Waltham Forest": 3, "Croydon": 3, "Harrow": 3, "Hillingdon": 3,
  "Bexley": 3, "Havering": 3, "Barking and Dagenham": 4, "City of London": 1,
  // Kent districts
  "Sevenoaks": 1, "Tonbridge and Malling": 2, "Tunbridge Wells": 2, "Maidstone": 3,
  "Dartford": 3, "Gravesham": 3, "Medway": 3, "Canterbury": 2, "Dover": 3,
  "Folkestone and Hythe": 3, "Thanet": 4, "Ashford": 3, "Swale": 3, "Kent": 3,
};

// ── Generate synthetic performance data ────────────────
function generatePerformanceData(school) {
  const rng = seedRandom(parseInt(school.urn) || 100000);
  const tier = BOROUGH_TIER[school.borough] || 3;
  const isPrivate = school.sector === "Private";
  const isGrammar = school.funding_type === "Grammar";
  const isOutstanding = school.ofsted_rating === "Outstanding";

  // Boost for selective/private schools
  const boost = (isPrivate ? 15 : 0) + (isGrammar ? 12 : 0) + (isOutstanding ? 5 : 0);
  const tierBoost = (4 - tier) * 5;

  const performance = { year: "2023" };

  if (school.phase === "Primary") {
    // KS2 data
    const base = 60 + tierBoost + boost;
    performance.ks2 = {
      reading: { expected: Math.min(95, seededInt(rng, base, base + 20)), greaterDepth: seededInt(rng, 15, 40) },
      writing: { expected: Math.min(95, seededInt(rng, base - 5, base + 15)), greaterDepth: seededInt(rng, 10, 35) },
      maths: { expected: Math.min(95, seededInt(rng, base, base + 20)), greaterDepth: seededInt(rng, 15, 40) },
      gps: { expected: Math.min(95, seededInt(rng, base, base + 20)) },
      combined: Math.min(90, seededInt(rng, base - 10, base + 10)),
      progress: {
        reading: seededFloat(rng, -1.5, 3.0),
        writing: seededFloat(rng, -1.5, 3.0),
        maths: seededFloat(rng, -1.5, 3.0),
      }
    };
  } else if (school.phase === "Secondary" || school.phase === "All-Through") {
    // KS4 data
    const baseA8 = 40 + tierBoost + boost;
    const baseP8 = (tierBoost + boost) / 30;

    performance.ks4 = {
      attainment8: seededFloat(rng, baseA8, Math.min(80, baseA8 + 15)),
      progress8: seededFloat(rng, baseP8 - 0.5, Math.min(1.5, baseP8 + 0.5)),
      ebaccEntry: seededInt(rng, 20 + tierBoost, Math.min(95, 50 + tierBoost + boost)),
      ebaccAvg: seededFloat(rng, 3.5 + tierBoost/10, Math.min(7.5, 5.0 + tierBoost/10 + boost/10)),
      grade5EnMa: seededInt(rng, 30 + tierBoost + boost/2, Math.min(95, 60 + tierBoost + boost)),
      subjects: {
        english: seededFloat(rng, 4.0, 7.5),
        maths: seededFloat(rng, 4.0, 7.5),
        science: seededFloat(rng, 4.0, 7.0),
        history: seededFloat(rng, 4.0, 7.0),
        geography: seededFloat(rng, 4.0, 7.0),
        languages: seededFloat(rng, 3.5, 7.0),
        art: seededFloat(rng, 4.5, 7.5),
        music: seededFloat(rng, 4.5, 7.5),
        pe: seededFloat(rng, 5.0, 7.5),
        computing: seededFloat(rng, 4.0, 7.0),
        drama: seededFloat(rng, 4.5, 7.5),
        business: seededFloat(rng, 4.0, 7.0),
      }
    };

    // KS5 data if has sixth form
    if (school.has_sixth_form) {
      const baseAPS = 30 + tierBoost + boost/2;
      performance.ks5 = {
        avgPointScore: seededFloat(rng, baseAPS, Math.min(50, baseAPS + 10)),
        aabOrHigher: seededInt(rng, 10 + tierBoost + boost/2, Math.min(80, 30 + tierBoost + boost)),
        subjects: {
          maths: seededFloat(rng, 25, 45),
          furtherMaths: seededFloat(rng, 28, 48),
          english: seededFloat(rng, 25, 42),
          physics: seededFloat(rng, 25, 45),
          chemistry: seededFloat(rng, 25, 45),
          biology: seededFloat(rng, 25, 45),
          history: seededFloat(rng, 25, 42),
          geography: seededFloat(rng, 25, 42),
          economics: seededFloat(rng, 28, 45),
          psychology: seededFloat(rng, 25, 42),
          art: seededFloat(rng, 28, 45),
          languages: seededFloat(rng, 25, 42),
          computerScience: seededFloat(rng, 25, 45),
        },
        destinations: {
          university: seededInt(rng, 50 + tierBoost, Math.min(98, 75 + tierBoost + boost/2)),
          russellGroup: seededInt(rng, 10 + tierBoost + boost/3, Math.min(80, 30 + tierBoost + boost/2)),
          oxbridge: isGrammar || isPrivate ? seededInt(rng, 5, 25) : seededInt(rng, 0, 8),
          apprenticeships: seededInt(rng, 5, 20),
          employment: seededInt(rng, 2, 15),
        }
      };
    }
  }

  return performance;
}

// ── Generate synthetic admissions data ────────────────
function generateAdmissionsData(school) {
  const rng = seedRandom(parseInt(school.urn) || 100000);
  const tier = BOROUGH_TIER[school.borough] || 3;
  const isPopular = school.ofsted_rating === "Outstanding" || school.funding_type === "Grammar";

  const capacity = school.pupils || 200;
  const demandMultiplier = isPopular ? seededFloat(rng, 2.5, 5.0) : seededFloat(rng, 1.2, 2.5);
  const applicationsTotal = Math.round(capacity * demandMultiplier);

  const baseRadius = school.phase === "Primary" ? 0.8 : 2.5;
  const officialRadius = seededFloat(rng, baseRadius * 0.8, baseRadius * 1.5, 2);
  const effectiveRadius = isPopular ? seededFloat(rng, officialRadius * 0.3, officialRadius * 0.7, 2) : seededFloat(rng, officialRadius * 0.6, officialRadius * 1.0, 2);

  // Generate 3-year catchment history
  const catchmentHistory = [];
  for (let year = 2021; year <= 2023; year++) {
    catchmentHistory.push({
      year: year.toString(),
      lastDistance: seededFloat(rng, effectiveRadius * 0.8, effectiveRadius * 1.2, 3),
      offers: Math.round(capacity * seededFloat(rng, 0.95, 1.05)),
    });
  }

  // Admission criteria
  const criteria = [
    { priority: 1, category: "Looked After Children", description: "Children in care or previously in care" },
    { priority: 2, category: "Siblings", description: "Children with siblings at the school" },
    { priority: 3, category: "Distance", description: "Proximity to school (straight line)" },
  ];

  if (school.religious_character && school.religious_character !== "None") {
    criteria.splice(2, 0, { priority: 3, category: "Faith", description: `Regular church attendance (${school.religious_character})` });
    criteria[3].priority = 4;
  }

  if (school.funding_type === "Grammar") {
    criteria.splice(1, 0, { priority: 2, category: "Aptitude", description: "11+ examination performance" });
    criteria.forEach((c, i) => c.priority = i + 1);
  }

  // Generate open days
  const months = ["September", "October", "November"];
  const openDays = months.map(month => ({
    date: `${seededInt(rng, 5, 25)} ${month} 2024`,
    time: seededPick(rng, ["9:30am", "10:00am", "2:00pm", "6:00pm"]),
    type: seededPick(rng, ["Open Morning", "Open Evening", "Tour"]),
  }));

  return {
    year: "2023",
    capacity,
    applications: {
      total: applicationsTotal,
      first: Math.round(applicationsTotal * seededFloat(rng, 0.5, 0.7)),
      second: Math.round(applicationsTotal * seededFloat(rng, 0.15, 0.25)),
      third: Math.round(applicationsTotal * seededFloat(rng, 0.1, 0.15)),
    },
    oversubscribed: applicationsTotal > capacity,
    lastDistanceOffered: effectiveRadius,
    catchment: {
      officialRadius,
      effectiveRadius,
      history: catchmentHistory,
    },
    criteria,
    appeals: {
      lodged: isPopular ? seededInt(rng, 20, 80) : seededInt(rng, 5, 25),
      successful: seededInt(rng, 0, 10),
    },
    openDays,
    applicationDeadline: school.phase === "Secondary" ? "31 October 2024" : "15 January 2025",
  };
}

// ── Generate synthetic demographics data ────────────────
function generateDemographicsData(school) {
  const rng = seedRandom(parseInt(school.urn) || 100000);
  const tier = BOROUGH_TIER[school.borough] || 3;

  const baseFsm = tier === 1 ? 8 : tier === 2 ? 15 : tier === 3 ? 25 : 35;

  return {
    fsmPercent: seededFloat(rng, baseFsm - 5, baseFsm + 10),
    ealPercent: seededFloat(rng, 15, 60),
    senPercent: seededFloat(rng, 8, 20),
    ethnicities: {
      whitebritish: seededInt(rng, 30, 70),
      asian: seededInt(rng, 5, 30),
      black: seededInt(rng, 5, 25),
      mixed: seededInt(rng, 5, 15),
      other: seededInt(rng, 2, 10),
    }
  };
}

// ── Generate synthetic Ofsted data ────────────────
function generateOfstedData(school) {
  const rng = seedRandom(parseInt(school.urn) || 100000);

  const ratings = ["Outstanding", "Good", "Requires Improvement", "Inadequate"];
  const currentRating = school.ofsted_rating || "Good";

  // Generate previous rating (usually same or one grade different)
  let prevIdx = ratings.indexOf(currentRating);
  if (prevIdx === -1) prevIdx = 1; // Default to Good
  const prevRating = seededPick(rng, [
    ratings[Math.max(0, prevIdx - 1)],
    ratings[prevIdx],
    ratings[Math.min(3, prevIdx + 1)],
  ]);

  const year = seededInt(rng, 2019, 2023);
  const month = seededInt(rng, 1, 12);

  return {
    rating: currentRating,
    inspectionDate: `${year}-${String(month).padStart(2, "0")}-${seededInt(rng, 1, 28)}`,
    previousRating: prevRating,
    previousDate: `${year - seededInt(rng, 2, 5)}-${String(seededInt(rng, 1, 12)).padStart(2, "0")}-${seededInt(rng, 1, 28)}`,
    reportUrl: `https://reports.ofsted.gov.uk/provider/21/${school.urn}`,
    parentView: {
      recommend: seededInt(rng, 70, 98),
      happy: seededInt(rng, 75, 98),
      safe: seededInt(rng, 85, 100),
      wellBehaved: seededInt(rng, 70, 95),
      bullying: seededInt(rng, 60, 90),
    }
  };
}

// ── Generate synthetic contact data ────────────────
function generateContactData(school) {
  const rng = seedRandom(parseInt(school.urn) || 100000);

  const firstNames = ["Sarah", "John", "Emma", "Michael", "Rachel", "David", "Claire", "James", "Helen", "Richard"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Taylor", "Davies", "Wilson", "Evans", "Thomas"];

  const firstName = seededPick(rng, firstNames);
  const lastName = seededPick(rng, lastNames);

  const areaCode = school.region === "Kent" ? "01622" : "020";
  const phoneNumber = `${areaCode} ${seededInt(rng, 100, 999)} ${seededInt(rng, 1000, 9999)}`;

  const domain = school.website ? school.website.replace("https://www.", "").replace("http://", "") : `${school.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.sch.uk`;

  return {
    phone: phoneNumber,
    email: `office@${domain}`,
    headteacher: `${seededPick(rng, ["Mr", "Mrs", "Ms", "Dr"])} ${firstName} ${lastName}`,
  };
}

// ── Generate synthetic finance data ────────────────
function generateFinanceData(school) {
  const rng = seedRandom(parseInt(school.urn) || 100000);
  const tier = BOROUGH_TIER[school.borough] || 3;

  const baseFunding = school.phase === "Primary" ? 4500 : 5500;
  const tierAdjustment = (4 - tier) * 200;
  const perPupilFunding = baseFunding + tierAdjustment + seededInt(rng, -300, 500);

  const pupils = school.pupils || 500;
  const totalIncome = pupils * perPupilFunding;

  const ratio = school.phase === "Primary" ? seededFloat(rng, 18, 26) : seededFloat(rng, 14, 20);
  const teacherCount = Math.round(pupils / ratio);

  return {
    totalIncome,
    perPupilFunding,
    teacherCount,
    pupilTeacherRatio: ratio,
  };
}

// ── Export schools ────────────────
const schools = db.prepare(`
  SELECT id, urn, name, borough, region, phase, type, gender, religious_character,
    ofsted_rating, age_range, pupils, address, postcode, lat, lng, has_sixth_form,
    funding_type, sector, website
  FROM schools
  ORDER BY name
`).all();

console.log(`Exporting ${schools.length} schools...`);

// Transform to frontend format with enriched data
const exportedSchools = schools.map((s, idx) => {
  const school = {
    id: idx + 1,
    urn: s.urn,
    name: s.name,
    borough: s.borough,
    type: s.phase,
    phase: s.phase,
    gender: s.gender,
    religiousCharacter: s.religious_character,
    ofstedRating: s.ofsted_rating,
    ageRange: s.age_range,
    pupils: s.pupils,
    address: s.address,
    postcode: s.postcode,
    lat: s.lat,
    lng: s.lng,
    hasSixthForm: s.has_sixth_form === 1,
    fundingType: s.funding_type,
    sector: s.sector,
    website: s.website,
    region: s.region,
  };

  // Add enriched data
  school.performance = generatePerformanceData(s);
  school.admissions = generateAdmissionsData(s);
  school.demographics = generateDemographicsData(s);
  school.ofsted = generateOfstedData(s);
  school.contact = generateContactData(s);
  school.finance = generateFinanceData(s);

  return school;
});

// Generate JavaScript output
const output = `// Generated by Schoolter Data Pipeline
// ${new Date().toISOString()}
// Total: ${exportedSchools.length} schools (London + Kent)

window.SCHOOLS_DATA = ${JSON.stringify(exportedSchools, null, 2)};
`;

// Ensure directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(path.dirname(OUTPUT_PATH));
ensureDir(path.dirname(DOCS_OUTPUT_PATH));

// Write to both locations
fs.writeFileSync(OUTPUT_PATH, output);
fs.writeFileSync(DOCS_OUTPUT_PATH, output);

console.log(`Exported to:`);
console.log(`  - ${OUTPUT_PATH}`);
console.log(`  - ${DOCS_OUTPUT_PATH}`);

// Summary by region
const londonCount = exportedSchools.filter(s => s.region === "London").length;
const kentCount = exportedSchools.filter(s => s.region === "Kent").length;
console.log(`\nBreakdown:`);
console.log(`  - London: ${londonCount} schools`);
console.log(`  - Kent: ${kentCount} schools`);

db.close();
