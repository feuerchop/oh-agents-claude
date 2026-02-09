/**
 * Database initialization — creates tables and seeds users + schools.
 * Run: npm run db:init
 */
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "schoolter.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── User Schema ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    plan          TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','pro','enterprise')),
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    subscription_status   TEXT DEFAULT 'none' CHECK(subscription_status IN ('none','active','past_due','canceled','trialing')),
    subscription_period_end TEXT,
    avatar_url    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    detail     TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_invoice_id   TEXT,
    amount_cents        INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'gbp',
    status              TEXT NOT NULL DEFAULT 'pending',
    description         TEXT,
    period_start        TEXT,
    period_end          TEXT,
    pdf_url             TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
`);

// ── School Schema ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    urn TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    borough TEXT NOT NULL,
    region TEXT DEFAULT 'London',
    phase TEXT,
    type TEXT,
    gender TEXT DEFAULT 'Mixed',
    religious_character TEXT DEFAULT 'None',
    ofsted_rating TEXT,
    age_range TEXT,
    pupils INTEGER,
    address TEXT,
    postcode TEXT,
    lat REAL,
    lng REAL,
    has_sixth_form INTEGER DEFAULT 0,
    funding_type TEXT,
    sector TEXT DEFAULT 'State',
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS school_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_urn TEXT NOT NULL,
    year TEXT,
    ks2_reading_expected REAL,
    ks2_maths_expected REAL,
    ks2_writing_expected REAL,
    ks2_gps_expected REAL,
    ks2_combined_expected REAL,
    ks2_reading_progress REAL,
    ks2_maths_progress REAL,
    ks2_writing_progress REAL,
    ks4_attainment8 REAL,
    ks4_progress8 REAL,
    ks4_ebacc_entry REAL,
    ks4_ebacc_avg REAL,
    ks4_grade5_en_ma REAL,
    ks4_subjects TEXT,
    ks5_average_point_score REAL,
    ks5_aab_or_higher REAL,
    ks5_subjects TEXT,
    ks5_destinations TEXT,
    FOREIGN KEY (school_urn) REFERENCES schools(urn)
  );

  CREATE TABLE IF NOT EXISTS school_admissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_urn TEXT NOT NULL,
    year TEXT,
    capacity INTEGER,
    applications_total INTEGER,
    applications_first INTEGER,
    applications_second INTEGER,
    applications_third INTEGER,
    oversubscribed INTEGER DEFAULT 0,
    last_distance_offered REAL,
    catchment_official_radius REAL,
    catchment_effective_radius REAL,
    catchment_history TEXT,
    criteria TEXT,
    appeals_lodged INTEGER,
    appeals_successful INTEGER,
    open_days TEXT,
    application_deadline TEXT,
    FOREIGN KEY (school_urn) REFERENCES schools(urn)
  );

  CREATE TABLE IF NOT EXISTS school_demographics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_urn TEXT NOT NULL,
    fsm_percent REAL,
    eal_percent REAL,
    sen_percent REAL,
    ethnicities TEXT,
    FOREIGN KEY (school_urn) REFERENCES schools(urn)
  );

  CREATE TABLE IF NOT EXISTS school_ofsted (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_urn TEXT NOT NULL,
    rating TEXT,
    inspection_date TEXT,
    previous_rating TEXT,
    previous_date TEXT,
    report_url TEXT,
    parent_view TEXT,
    FOREIGN KEY (school_urn) REFERENCES schools(urn)
  );

  CREATE TABLE IF NOT EXISTS school_contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_urn TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    headteacher TEXT,
    FOREIGN KEY (school_urn) REFERENCES schools(urn)
  );

  CREATE TABLE IF NOT EXISTS school_finances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_urn TEXT NOT NULL,
    total_income INTEGER,
    per_pupil_funding INTEGER,
    teacher_count INTEGER,
    pupil_teacher_ratio REAL,
    FOREIGN KEY (school_urn) REFERENCES schools(urn)
  );

  CREATE INDEX IF NOT EXISTS idx_schools_borough ON schools(borough);
  CREATE INDEX IF NOT EXISTS idx_schools_region ON schools(region);
  CREATE INDEX IF NOT EXISTS idx_schools_phase ON schools(phase);
  CREATE INDEX IF NOT EXISTS idx_schools_postcode ON schools(postcode);
  CREATE INDEX IF NOT EXISTS idx_performance_urn ON school_performance(school_urn);
  CREATE INDEX IF NOT EXISTS idx_admissions_urn ON school_admissions(school_urn);
`);

// ── Seed admin user ─────────────────────────────────────────────
const adminEmail = "admin@schoolter.app";
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);

if (!existing) {
  const hash = bcrypt.hashSync("admin123!", 12);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, plan, subscription_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuid(), adminEmail, hash, "Admin", "admin", "enterprise", "active");
  console.log("Seeded admin user: admin@schoolter.app / admin123!");
}

// ── Seed schools ─────────────────────────────────────────────
const LONDON_SCHOOLS = require("./london_schools_seed.js");

// Real Kent schools data
const KENT_SCHOOLS = [
  // Grammar Schools
  { name: "Tonbridge Grammar School", urn: "118900", borough: "Tonbridge and Malling", phase: "Secondary", gender: "Girls", pupils: 1050, lat: 51.1958, lng: 0.2718, postcode: "TN9 2JR", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "Tunbridge Wells Grammar School for Boys", urn: "118898", borough: "Tunbridge Wells", phase: "Secondary", gender: "Boys", pupils: 1100, lat: 51.1329, lng: 0.2616, postcode: "TN2 3UT", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Tunbridge Wells Girls' Grammar School", urn: "118896", borough: "Tunbridge Wells", phase: "Secondary", gender: "Girls", pupils: 1050, lat: 51.1345, lng: 0.2589, postcode: "TN4 9UJ", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "Dartford Grammar School", urn: "118880", borough: "Dartford", phase: "Secondary", gender: "Boys", pupils: 1150, lat: 51.4464, lng: 0.2184, postcode: "DA1 2BH", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "Dartford Grammar School for Girls", urn: "118882", borough: "Dartford", phase: "Secondary", gender: "Girls", pupils: 1100, lat: 51.4489, lng: 0.2156, postcode: "DA1 1JZ", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "Maidstone Grammar School", urn: "118892", borough: "Maidstone", phase: "Secondary", gender: "Boys", pupils: 1200, lat: 51.2689, lng: 0.5246, postcode: "ME15 6AT", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Maidstone Grammar School for Girls", urn: "118894", borough: "Maidstone", phase: "Secondary", gender: "Girls", pupils: 1150, lat: 51.2656, lng: 0.5198, postcode: "ME15 6DJ", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "The Judd School", urn: "118842", borough: "Tonbridge and Malling", phase: "Secondary", gender: "Boys", pupils: 1100, lat: 51.1923, lng: 0.2673, postcode: "TN9 2PN", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "Sevenoaks School", urn: "118844", borough: "Sevenoaks", phase: "Secondary", gender: "Mixed", pupils: 1100, lat: 51.2782, lng: 0.1883, postcode: "TN13 1HU", hasSixthForm: true, ofstedRating: "N/A", sector: "Private" },
  { name: "Cranbrook School", urn: "118788", borough: "Tunbridge Wells", phase: "Secondary", gender: "Mixed", pupils: 800, lat: 51.0976, lng: 0.5352, postcode: "TN17 3JD", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Dover Grammar School for Boys", urn: "118820", borough: "Dover", phase: "Secondary", gender: "Boys", pupils: 850, lat: 51.1296, lng: 1.3086, postcode: "CT16 2LY", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Dover Grammar School for Girls", urn: "118822", borough: "Dover", phase: "Secondary", gender: "Girls", pupils: 800, lat: 51.1312, lng: 1.3052, postcode: "CT16 2PL", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Highsted Grammar School", urn: "118836", borough: "Swale", phase: "Secondary", gender: "Girls", pupils: 950, lat: 51.3434, lng: 0.7321, postcode: "ME10 4PT", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Borden Grammar School", urn: "118838", borough: "Swale", phase: "Secondary", gender: "Boys", pupils: 900, lat: 51.3389, lng: 0.7298, postcode: "ME10 1PX", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Simon Langton Grammar School for Boys", urn: "118824", borough: "Canterbury", phase: "Secondary", gender: "Boys", pupils: 1050, lat: 51.2645, lng: 1.0832, postcode: "CT4 7AS", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "Simon Langton Girls' Grammar School", urn: "118826", borough: "Canterbury", phase: "Secondary", gender: "Girls", pupils: 1000, lat: 51.2678, lng: 1.0856, postcode: "CT1 3RD", hasSixthForm: true, ofstedRating: "Outstanding" },
  { name: "The Harvey Grammar School", urn: "118834", borough: "Folkestone and Hythe", phase: "Secondary", gender: "Boys", pupils: 850, lat: 51.0789, lng: 1.1656, postcode: "CT20 1JU", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Folkestone School for Girls", urn: "118832", borough: "Folkestone and Hythe", phase: "Secondary", gender: "Girls", pupils: 850, lat: 51.0812, lng: 1.1689, postcode: "CT20 1QY", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Chatham Grammar School for Girls", urn: "137064", borough: "Medway", phase: "Secondary", gender: "Girls", pupils: 1000, lat: 51.3789, lng: 0.5234, postcode: "ME4 6NH", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Fort Pitt Grammar School", urn: "137066", borough: "Medway", phase: "Secondary", gender: "Mixed", pupils: 950, lat: 51.3856, lng: 0.5312, postcode: "ME4 6TE", hasSixthForm: true, ofstedRating: "Good" },
  // Academies and Comprehensive Schools
  { name: "Astor College for the Arts", urn: "118789", borough: "Dover", phase: "Secondary", gender: "Mixed", pupils: 1200, lat: 51.1256, lng: 1.3124, postcode: "CT17 9NJ", hasSixthForm: true, ofstedRating: "Good" },
  { name: "The Canterbury Academy", urn: "136428", borough: "Canterbury", phase: "Secondary", gender: "Mixed", pupils: 1350, lat: 51.2789, lng: 1.0912, postcode: "CT1 3WD", hasSixthForm: true, ofstedRating: "Good" },
  { name: "The Marsh Academy", urn: "136512", borough: "Folkestone and Hythe", phase: "Secondary", gender: "Mixed", pupils: 950, lat: 51.0234, lng: 0.9876, postcode: "TN29 0AB", hasSixthForm: false, ofstedRating: "Requires Improvement" },
  { name: "St George's Church of England School", urn: "136514", borough: "Gravesham", phase: "Secondary", gender: "Mixed", pupils: 1100, lat: 51.4389, lng: 0.3689, postcode: "DA12 4LT", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Wilmington Grammar School for Boys", urn: "118862", borough: "Dartford", phase: "Secondary", gender: "Boys", pupils: 950, lat: 51.4356, lng: 0.2089, postcode: "DA2 7DR", hasSixthForm: true, ofstedRating: "Good" },
  { name: "Wilmington Grammar School for Girls", urn: "118864", borough: "Dartford", phase: "Secondary", gender: "Girls", pupils: 920, lat: 51.4378, lng: 0.2056, postcode: "DA2 7DG", hasSixthForm: true, ofstedRating: "Good" },
  { name: "King's School Rochester", urn: "118790", borough: "Medway", phase: "Secondary", gender: "Mixed", pupils: 750, lat: 51.3889, lng: 0.5056, postcode: "ME1 1TE", hasSixthForm: true, ofstedRating: "N/A", sector: "Private" },
  { name: "Benenden School", urn: "118786", borough: "Tunbridge Wells", phase: "Secondary", gender: "Girls", pupils: 550, lat: 51.0789, lng: 0.5856, postcode: "TN17 4AA", hasSixthForm: true, ofstedRating: "N/A", sector: "Private" },
  // Primary Schools
  { name: "St Peter's Methodist Primary School", urn: "118500", borough: "Canterbury", phase: "Primary", gender: "Mixed", pupils: 420, lat: 51.2756, lng: 1.0789, postcode: "CT1 2BE", hasSixthForm: false, ofstedRating: "Outstanding" },
  { name: "Blean Primary School", urn: "118502", borough: "Canterbury", phase: "Primary", gender: "Mixed", pupils: 380, lat: 51.2934, lng: 1.0456, postcode: "CT2 9HB", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Temple Hill Primary School", urn: "118510", borough: "Dartford", phase: "Primary", gender: "Mixed", pupils: 450, lat: 51.4412, lng: 0.2234, postcode: "DA1 5NE", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Stone St Mary's Church of England Primary", urn: "118512", borough: "Dartford", phase: "Primary", gender: "Mixed", pupils: 410, lat: 51.4489, lng: 0.2378, postcode: "DA9 9DJ", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Maidstone, St Michael's Junior School", urn: "118520", borough: "Maidstone", phase: "Primary", gender: "Mixed", pupils: 360, lat: 51.2712, lng: 0.5289, postcode: "ME14 2HE", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Loose Primary School", urn: "118522", borough: "Maidstone", phase: "Primary", gender: "Mixed", pupils: 420, lat: 51.2534, lng: 0.5156, postcode: "ME15 0BG", hasSixthForm: false, ofstedRating: "Outstanding" },
  { name: "Cliffe Woods Primary School", urn: "137300", borough: "Medway", phase: "Primary", gender: "Mixed", pupils: 400, lat: 51.4423, lng: 0.4956, postcode: "ME3 8NA", hasSixthForm: false, ofstedRating: "Good" },
  { name: "St Margaret's at Troy Town CE Primary", urn: "137102", borough: "Medway", phase: "Primary", gender: "Mixed", pupils: 380, lat: 51.3834, lng: 0.5089, postcode: "ME1 1JH", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Sevenoaks Primary School", urn: "118530", borough: "Sevenoaks", phase: "Primary", gender: "Mixed", pupils: 450, lat: 51.2756, lng: 0.1912, postcode: "TN13 1YE", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Dunton Green Primary School", urn: "118532", borough: "Sevenoaks", phase: "Primary", gender: "Mixed", pupils: 350, lat: 51.2889, lng: 0.1734, postcode: "TN13 2UR", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Margate Primary School", urn: "118540", borough: "Thanet", phase: "Primary", gender: "Mixed", pupils: 380, lat: 51.3845, lng: 1.3823, postcode: "CT9 2LW", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Ramsgate Holy Trinity CE Primary", urn: "118542", borough: "Thanet", phase: "Primary", gender: "Mixed", pupils: 420, lat: 51.3356, lng: 1.4156, postcode: "CT11 9PD", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Bishop Chavasse Primary School", urn: "118550", borough: "Tonbridge and Malling", phase: "Primary", gender: "Mixed", pupils: 390, lat: 51.1912, lng: 0.2689, postcode: "TN9 2SP", hasSixthForm: false, ofstedRating: "Outstanding" },
  { name: "Hildenborough CE Primary School", urn: "118552", borough: "Tonbridge and Malling", phase: "Primary", gender: "Mixed", pupils: 320, lat: 51.2134, lng: 0.2456, postcode: "TN11 9LL", hasSixthForm: false, ofstedRating: "Good" },
  { name: "St James' Church of England Primary", urn: "118560", borough: "Tunbridge Wells", phase: "Primary", gender: "Mixed", pupils: 420, lat: 51.1323, lng: 0.2612, postcode: "TN2 5TE", hasSixthForm: false, ofstedRating: "Outstanding" },
  { name: "Skinners' Kent Primary School", urn: "118562", borough: "Tunbridge Wells", phase: "Primary", gender: "Mixed", pupils: 450, lat: 51.1289, lng: 0.2534, postcode: "TN4 8JJ", hasSixthForm: false, ofstedRating: "Good" },
  // Nursery Schools
  { name: "Canterbury Nursery School", urn: "118600", borough: "Canterbury", phase: "Nursery", gender: "Mixed", pupils: 80, lat: 51.2789, lng: 1.0834, postcode: "CT1 2TU", hasSixthForm: false, ofstedRating: "Outstanding" },
  { name: "Maidstone Nursery School", urn: "118602", borough: "Maidstone", phase: "Nursery", gender: "Mixed", pupils: 75, lat: 51.2723, lng: 0.5212, postcode: "ME14 1RF", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Chatham Nursery School", urn: "137400", borough: "Medway", phase: "Nursery", gender: "Mixed", pupils: 85, lat: 51.3812, lng: 0.5178, postcode: "ME4 5XN", hasSixthForm: false, ofstedRating: "Good" },
  // Special Schools
  { name: "Five Acre Wood School", urn: "119000", borough: "Maidstone", phase: "Special", gender: "Mixed", pupils: 220, lat: 51.2589, lng: 0.5089, postcode: "ME15 9TT", hasSixthForm: false, ofstedRating: "Outstanding" },
  { name: "Stone Bay School", urn: "119002", borough: "Thanet", phase: "Special", gender: "Mixed", pupils: 180, lat: 51.3634, lng: 1.3923, postcode: "CT10 1EB", hasSixthForm: false, ofstedRating: "Good" },
  { name: "Rowhill School", urn: "119004", borough: "Dartford", phase: "Special", gender: "Mixed", pupils: 150, lat: 51.4378, lng: 0.2156, postcode: "DA2 6QX", hasSixthForm: false, ofstedRating: "Good" },
];

// Combine all schools
const ALL_SCHOOLS = [...LONDON_SCHOOLS, ...KENT_SCHOOLS];

// Clear existing schools and re-seed
db.exec("DELETE FROM school_finances");
db.exec("DELETE FROM school_contact");
db.exec("DELETE FROM school_ofsted");
db.exec("DELETE FROM school_demographics");
db.exec("DELETE FROM school_admissions");
db.exec("DELETE FROM school_performance");
db.exec("DELETE FROM schools");

const insertSchool = db.prepare(`
  INSERT INTO schools (urn, name, borough, region, phase, type, gender, religious_character,
    ofsted_rating, age_range, pupils, address, postcode, lat, lng, has_sixth_form, funding_type, sector, website)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Determine region based on borough
const LONDON_BOROUGHS = [
  "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden",
  "City of London", "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney",
  "Hammersmith and Fulham", "Haringey", "Harrow", "Havering", "Hillingdon",
  "Hounslow", "Islington", "Kensington and Chelsea", "Kingston upon Thames",
  "Lambeth", "Lewisham", "Merton", "Newham", "Redbridge",
  "Richmond upon Thames", "Southwark", "Sutton", "Tower Hamlets",
  "Waltham Forest", "Wandsworth", "Westminster",
];

const insertMany = db.transaction((schools) => {
  for (const s of schools) {
    const region = LONDON_BOROUGHS.includes(s.borough) ? "London" : "Kent";
    const religiousCharacter = s.name.includes("Church of England") || s.name.includes("CE ") ? "Church of England" :
                               s.name.includes("Catholic") || s.name.includes("RC ") ? "Roman Catholic" :
                               s.name.includes("Methodist") ? "Methodist" :
                               s.name.includes("Jewish") || s.name.includes("JCoSS") ? "Jewish" : "None";
    const ageRange = s.phase === "Primary" ? "4-11" :
                     s.phase === "Secondary" ? (s.hasSixthForm ? "11-18" : "11-16") :
                     s.phase === "Nursery" ? "2-4" :
                     s.phase === "16 Plus" ? "16-19" :
                     s.phase === "All-Through" ? "4-18" : "5-19";
    const fundingType = s.sector === "Private" ? "Independent" :
                        s.name.includes("Grammar") ? "Grammar" :
                        s.name.includes("Academy") ? "Academy" : "Maintained";
    const website = s.website || `https://www.${s.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25)}.sch.uk`;

    insertSchool.run(
      s.urn,
      s.name,
      s.borough,
      region,
      s.phase,
      s.phase,
      s.gender,
      religiousCharacter,
      s.ofstedRating,
      ageRange,
      s.pupils,
      `${s.borough}`,
      s.postcode,
      s.lat,
      s.lng,
      s.hasSixthForm ? 1 : 0,
      fundingType,
      s.sector || "State",
      website
    );
  }
});

insertMany(ALL_SCHOOLS);
console.log(`Seeded ${ALL_SCHOOLS.length} schools (${LONDON_SCHOOLS.length} London + ${KENT_SCHOOLS.length} Kent)`);

console.log("Database initialized at", DB_PATH);
db.close();
