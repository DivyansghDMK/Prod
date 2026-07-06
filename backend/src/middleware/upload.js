"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the local uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Set up disk storage for multipart file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Preserve the original name but prefix it with timestamp to avoid name collisions
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "");
    cb(null, `${timestamp}-${cleanName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  },
});

module.exports = { upload, UPLOADS_DIR };
