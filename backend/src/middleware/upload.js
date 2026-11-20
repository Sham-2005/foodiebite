const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

// Temporary directory for in-memory / short-lived OCR processing only
// All files are deleted immediately after OCR extraction
const tempUploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempUploadDir),
  filename: (req, file, cb) => {
    const uid = (req.user && (req.user.uid || req.user.id)) || 'temp_user';
    const cleanExt = path.extname(file.originalname).toLowerCase() || '.pdf';
    const unique = `${uid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${cleanExt}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExt  = /\.(pdf|jpe?g|png|webp)$/i;
  const allowedMime = /^(application\/pdf|application\/octet-stream|image\/(jpeg|png|webp))$/i;
  const ext  = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedMime.test(file.mimetype);
  if (ext || mime) return cb(null, true);
  cb(new Error('Invalid file type. Only PDF and image files are allowed for medical reports.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 20 * 1024 * 1024 },
});

module.exports = upload;
