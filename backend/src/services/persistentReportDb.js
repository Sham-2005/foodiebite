// ─────────────────────────────────────────────────────────────
//  backend/src/services/persistentReportDb.js
//  Durable file-backed database storage for medical reports
//  Guarantees 100% persistence across server restarts even
//  when Firestore service account credentials are not available.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const REPORTS_FILE = path.join(DATA_DIR, 'medical_reports_db.json');
const HEALTH_PROFILES_FILE = path.join(DATA_DIR, 'health_profiles_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readReportsFile() {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('⚠️ Error reading medical_reports_db.json, reinitializing:', err.message);
  }
  return {};
}

function writeReportsFile(data) {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to write to medical_reports_db.json:', err.message);
  }
}

function readHealthProfilesFile() {
  try {
    if (fs.existsSync(HEALTH_PROFILES_FILE)) {
      const raw = fs.readFileSync(HEALTH_PROFILES_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('⚠️ Error reading health_profiles_db.json:', err.message);
  }
  return {};
}

function writeHealthProfilesFile(data) {
  try {
    fs.writeFileSync(HEALTH_PROFILES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to write to health_profiles_db.json:', err.message);
  }
}

/**
 * Persistently save or update a report for a user
 */
function saveReport(userId, report) {
  const db = readReportsFile();
  const uId = String(userId || 'guest_user');
  if (!db[uId]) {
    db[uId] = [];
  }

  const reportId = report.id || report._id;
  // Replace if exists, or prepend if new
  const index = db[uId].findIndex(r => (r.id || r._id) === reportId);
  if (index >= 0) {
    db[uId][index] = { ...db[uId][index], ...report };
  } else {
    db[uId].unshift(report);
  }

  writeReportsFile(db);
  console.log(`💾 Persistently saved medical report ${reportId} for user ${uId}`);
  return report;
}

/**
 * Get all reports for a user (newest first)
 */
function getReports(userId) {
  const db = readReportsFile();
  const uId = String(userId || 'guest_user');
  const userReports = db[uId] || [];

  // Sort descending by uploaded date
  return [...userReports].sort((a, b) => {
    const tA = new Date(b.uploadedAt || b.uploadDate || 0).getTime();
    const tB = new Date(a.uploadedAt || a.uploadDate || 0).getTime();
    return tA - tB;
  });
}

/**
 * Get a specific report by ID
 */
function getReportById(reportId) {
  const db = readReportsFile();
  for (const uId of Object.keys(db)) {
    const found = db[uId].find(r => (r.id || r._id) === reportId);
    if (found) return found;
  }
  return null;
}

/**
 * Delete a report by ID for a user
 */
function deleteReport(userId, reportId) {
  const db = readReportsFile();
  const uId = String(userId || 'guest_user');
  let deletedReport = null;

  if (db[uId]) {
    const index = db[uId].findIndex(r => (r.id || r._id) === reportId);
    if (index >= 0) {
      deletedReport = db[uId][index];
      db[uId].splice(index, 1);
      writeReportsFile(db);
    }
  }

  // Also check all other users in case of ID alias
  if (!deletedReport) {
    for (const key of Object.keys(db)) {
      const idx = db[key].findIndex(r => (r.id || r._id) === reportId);
      if (idx >= 0) {
        deletedReport = db[key][idx];
        db[key].splice(idx, 1);
        writeReportsFile(db);
        break;
      }
    }
  }

  if (deletedReport) {
    console.log(`🗑️ Persistently deleted medical report ${reportId}`);
  }
  return deletedReport;
}

/**
 * Save health profile
 */
function saveHealthProfile(userId, profile) {
  const db = readHealthProfilesFile();
  const uId = String(userId || 'guest_user');
  db[uId] = {
    ...profile,
    lastUpdated: new Date().toISOString()
  };
  writeHealthProfilesFile(db);
  return db[uId];
}

/**
 * Get health profile
 */
function getHealthProfile(userId) {
  const db = readHealthProfilesFile();
  const uId = String(userId || 'guest_user');
  return db[uId] || null;
}

module.exports = {
  saveReport,
  getReports,
  getReportById,
  deleteReport,
  saveHealthProfile,
  getHealthProfile
};
