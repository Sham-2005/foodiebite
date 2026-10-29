// ─────────────────────────────────────────────────────────────
//  backend/src/services/cloudStorageService.js
//  FoodieBite Unified Cloud & Local Storage Provider
//  Tiers:
//    1. Cloudinary (Active CDN Cloud Storage)
//    2. Firebase Storage (if GCP Admin credentials available)
//    3. Local disk fallback (served via Express /uploads)
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { getFirebaseAdmin } = require('../config/firebase');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true
  });
}

function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms))
  ]);
}

/**
 * Upload a medical report PDF to Cloud Storage with local disk backup
 */
async function uploadReportFile(localTempPath, userId, reportId, originalName, hostBaseUrl = 'http://localhost:5000') {
  // Always prepare local persistent backup copy
  const localUploadsDir = path.join(__dirname, '../../uploads/medical_reports');
  if (!fs.existsSync(localUploadsDir)) {
    fs.mkdirSync(localUploadsDir, { recursive: true });
  }
  const localPersistentPath = path.join(localUploadsDir, `${reportId}.pdf`);
  try {
    fs.copyFileSync(localTempPath, localPersistentPath);
  } catch (copyErr) {
    console.warn('⚠️ Could not create local backup copy:', copyErr.message);
  }

  const localFileUrl = `${hostBaseUrl}/uploads/medical_reports/${reportId}.pdf`;

  // ── Tier 1: Cloudinary Upload ──────────────────────────────
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    try {
      const cleanUserId = (userId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
      const uploadRes = await withTimeout(
        cloudinary.uploader.upload(localTempPath, {
          resource_type: 'auto',
          folder: `foodiebite/medical_reports/${cleanUserId}`,
          public_id: reportId,
          use_filename: false,
          unique_filename: false,
          overwrite: true
        }),
        8000
      );

      if (uploadRes && uploadRes.secure_url) {
        console.log(`☁️ Cloudinary upload successful for ${reportId}: ${uploadRes.secure_url}`);
        return {
          success: true,
          provider: 'cloudinary',
          fileUrl: localFileUrl,
          downloadUrl: localFileUrl,
          cloudinaryUrl: uploadRes.secure_url,
          publicId: uploadRes.public_id,
          format: uploadRes.format || 'pdf',
          bytes: uploadRes.bytes || 0,
          localBackupUrl: localFileUrl
        };
      }
    } catch (cErr) {
      console.warn('⚠️ Cloudinary upload warning, trying Firebase / Local fallback:', cErr.message);
    }
  }

  // ── Tier 2: Firebase Storage Upload (if configured) ────────
  try {
    const admin = getFirebaseAdmin();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'food-app-3d216.firebasestorage.app';
    if (admin && admin.apps.length > 0) {
      const bucket = admin.storage().bucket(bucketName);
      const destination = `medical-reports/${userId}/${reportId}.pdf`;
      await withTimeout(
        bucket.upload(localTempPath, {
          destination,
          metadata: {
            contentType: 'application/pdf',
            metadata: { userId, reportId, originalName }
          }
        }),
        3000
      );

      const file = bucket.file(destination);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      console.log(`☁️ Firebase Storage upload successful for ${reportId}`);
      return {
        success: true,
        provider: 'firebase',
        fileUrl: signedUrl,
        downloadUrl: signedUrl,
        storagePath: destination,
        localBackupUrl: localFileUrl
      };
    }
  } catch (fbErr) {
    console.warn('⚠️ Firebase storage warning (using local fallback):', fbErr.message);
  }

  // ── Tier 3: Local Disk Served via Express ───────────────────
  console.log(`💾 Storing report file locally: ${localFileUrl}`);
  return {
    success: true,
    provider: 'local',
    fileUrl: localFileUrl,
    downloadUrl: localFileUrl,
    localBackupUrl: localFileUrl
  };
}

/**
 * Delete a medical report file from Cloud Storage and Local Disk
 */
async function deleteReportFile(report) {
  if (!report) return;

  // 1. Delete from Cloudinary
  if (report.cloudinaryPublicId || (report.fileUrl && report.fileUrl.includes('cloudinary.com'))) {
    try {
      const publicId = report.cloudinaryPublicId || extractCloudinaryPublicId(report.fileUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => {});
        console.log(`🗑️ Cloudinary report destroyed: ${publicId}`);
      }
    } catch (cErr) {
      console.warn('⚠️ Cloudinary deletion warning:', cErr.message);
    }
  }

  // 2. Delete from Firebase Storage
  if (report.storagePath) {
    try {
      const admin = getFirebaseAdmin();
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'food-app-3d216.firebasestorage.app';
      if (admin && admin.apps.length > 0) {
        const bucket = admin.storage().bucket(bucketName);
        await bucket.file(report.storagePath).delete().catch(() => {});
      }
    } catch (_) {}
  }

  // 3. Delete local disk copy
  const reportId = report.id || report._id;
  if (reportId) {
    try {
      const localPath = path.join(__dirname, '../../uploads/medical_reports', `${reportId}.pdf`);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (_) {}
  }
}

function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
}

module.exports = {
  uploadReportFile,
  deleteReportFile,
  extractCloudinaryPublicId
};
