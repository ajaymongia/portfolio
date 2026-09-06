'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

/**
 * Image uploads land in public/uploads/ and are referenced by web path, so
 * they are served like any other static asset and survive a static build.
 */

const DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(DIR, { recursive: true });

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR),
  filename: (req, file, cb) => {
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'file';
    const stamp = Date.now().toString(36);
    cb(null, `${base}-${stamp}${ALLOWED[file.mimetype] || ''}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
});

/** Web path for a stored upload, or null when nothing was sent. */
function webPath(file) {
  return file ? `/uploads/${file.filename}` : null;
}

module.exports = { upload, webPath, DIR };
