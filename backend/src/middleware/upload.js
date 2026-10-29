const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const uid    = (req.user && (req.user.uid || req.user.id)) || 'unknown';
    const unique = `${uid}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExt  = /pdf/;
  const allowedMime = /pdf|octet-stream/;  // octet-stream: some browsers send this for PDFs
  const ext  = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedMime.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only PDF files are allowed. Please upload a valid PDF medical report.'));
};

const upload = multer({
  storage,
  fileFilter,
  // 20 MB limit — respects MAX_FILE_SIZE env override
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024 },
});

module.exports = upload;
