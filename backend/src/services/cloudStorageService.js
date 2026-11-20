// ─────────────────────────────────────────────────────────────
//  backend/src/services/cloudStorageService.js
//  DECOMMISSIONED STORAGE SERVICE
//  Cloudinary, Firebase Storage, and permanent local disk storage
//  have been completely replaced by Supabase Storage bucket 'medical-reports'.
//  This module is retained as a compatibility stub.
// ─────────────────────────────────────────────────────────────

async function uploadReportFile(localTempPath, userId, reportId, originalName, hostBaseUrl = 'http://localhost:5000') {
  const cleanFileName = (originalName || 'medical_report.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${reportId}-${cleanFileName}`;
  return {
    success: true,
    provider: 'supabase',
    storagePath,
    fileUrl: storagePath,
    downloadUrl: storagePath,
    publicId: reportId
  };
}

async function deleteReportFile(report) {
  return { success: true };
}

module.exports = {
  uploadReportFile,
  deleteReportFile
};
