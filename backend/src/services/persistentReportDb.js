// ─────────────────────────────────────────────────────────────
//  backend/src/services/persistentReportDb.js
//  DECOMMISSIONED DISK STORAGE STUB
//  Supabase is the single source of truth for all FoodieBite medical reports.
//  Permanent disk and JSON file database storage have been completely eliminated.
//  This module maintains an in-memory ephemeral fallback cache for unit tests only.
// ─────────────────────────────────────────────────────────────

const memoryReports = new Map();
const memoryHealthProfiles = new Map();

function saveReport(userId, report) {
  const uId = String(userId || 'guest_user');
  if (!memoryReports.has(uId)) {
    memoryReports.set(uId, []);
  }
  const list = memoryReports.get(uId);
  const rId = report.id || report._id;
  const index = list.findIndex(r => (r.id || r._id) === rId);
  if (index >= 0) {
    list[index] = { ...list[index], ...report };
  } else {
    list.unshift(report);
  }
  return report;
}

function getReports(userId) {
  const uId = String(userId || 'guest_user');
  const userReports = memoryReports.get(uId) || [];
  return [...userReports].sort((a, b) => {
    const tA = new Date(b.uploadedAt || b.uploadDate || 0).getTime();
    const tB = new Date(a.uploadedAt || a.uploadDate || 0).getTime();
    return tA - tB;
  });
}

function getReportById(reportId) {
  for (const list of memoryReports.values()) {
    const found = list.find(r => (r.id || r._id) === reportId);
    if (found) return found;
  }
  return null;
}

function deleteReport(userId, reportId) {
  const uId = String(userId || 'guest_user');
  let deletedReport = null;
  if (memoryReports.has(uId)) {
    const list = memoryReports.get(uId);
    const idx = list.findIndex(r => (r.id || r._id) === reportId);
    if (idx >= 0) {
      deletedReport = list.splice(idx, 1)[0];
    }
  }
  return deletedReport;
}

function saveHealthProfile(userId, profile) {
  const uId = String(userId || 'guest_user');
  const record = {
    ...profile,
    lastUpdated: new Date().toISOString()
  };
  memoryHealthProfiles.set(uId, record);
  return record;
}

function getHealthProfile(userId) {
  const uId = String(userId || 'guest_user');
  return memoryHealthProfiles.get(uId) || null;
}

module.exports = {
  saveReport,
  getReports,
  getReportById,
  deleteReport,
  saveHealthProfile,
  getHealthProfile
};
