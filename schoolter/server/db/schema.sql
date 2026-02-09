-- Schoolter Database Schema
-- SQLite database for storing school data

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
  -- KS2
  ks2_reading_expected REAL,
  ks2_maths_expected REAL,
  ks2_writing_expected REAL,
  ks2_gps_expected REAL,
  ks2_combined_expected REAL,
  ks2_reading_progress REAL,
  ks2_maths_progress REAL,
  ks2_writing_progress REAL,
  -- KS4
  ks4_attainment8 REAL,
  ks4_progress8 REAL,
  ks4_ebacc_entry REAL,
  ks4_ebacc_avg REAL,
  ks4_grade5_en_ma REAL,
  ks4_subjects TEXT, -- JSON
  -- KS5
  ks5_average_point_score REAL,
  ks5_aab_or_higher REAL,
  ks5_subjects TEXT, -- JSON
  ks5_destinations TEXT, -- JSON
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
  catchment_history TEXT, -- JSON
  criteria TEXT, -- JSON
  appeals_lodged INTEGER,
  appeals_successful INTEGER,
  open_days TEXT, -- JSON
  application_deadline TEXT,
  FOREIGN KEY (school_urn) REFERENCES schools(urn)
);

CREATE TABLE IF NOT EXISTS school_demographics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_urn TEXT NOT NULL,
  fsm_percent REAL,
  eal_percent REAL,
  sen_percent REAL,
  ethnicities TEXT, -- JSON
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
  parent_view TEXT, -- JSON
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_schools_borough ON schools(borough);
CREATE INDEX IF NOT EXISTS idx_schools_region ON schools(region);
CREATE INDEX IF NOT EXISTS idx_schools_phase ON schools(phase);
CREATE INDEX IF NOT EXISTS idx_schools_postcode ON schools(postcode);
CREATE INDEX IF NOT EXISTS idx_performance_urn ON school_performance(school_urn);
CREATE INDEX IF NOT EXISTS idx_admissions_urn ON school_admissions(school_urn);
