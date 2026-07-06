"use strict";

const { asyncHandler } = require("../utils/asyncHandler");
const { createDesktopService } = require("./desktop.service");

function _getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createDesktopService(pool);
}

function _caller(req) {
  return {
    user: req.user || null,
    role: req.role || null,
    organization: req.organization || null,
    permissions: req.permissions || [],
  };
}

function _getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

const login = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.login(req.body || {}, {
    deviceName: req.body.deviceName || req.headers["user-agent"] || "Desktop Client",
    ipAddress: _getIp(req),
  });
  res.json(result);
});

const reportUpload = asyncHandler(async (req, res) => {
  const service = _getService(req);
  
  // Parse metadata from multer text field if present
  let payload = {};
  if (req.body.metadata) {
    try {
      payload = JSON.parse(req.body.metadata);
    } catch (err) {
      return res.status(400).json({ message: "Invalid metadata JSON format" });
    }
  } else {
    payload = req.body;
  }

  // Multer populates req.files
  const filesList = [];
  const incomingFiles = req.files || (req.file ? [req.file] : []);

  const crypto = require("crypto");
  const fs = require("fs");

  for (const f of incomingFiles) {
    let checksum = "";
    try {
      const hash = crypto.createHash("sha256");
      const buffer = fs.readFileSync(f.path);
      hash.update(buffer);
      checksum = hash.digest("hex");
    } catch (err) {
      // ignore
    }

    filesList.push({
      file_type: String(f.originalname).toLowerCase().endsWith(".pdf") ? "PDF" : "JSON",
      s3_key: `uploads/${f.filename}`,
      file_size: f.size,
      checksum: checksum,
      temp_path: f.path,
    });
  }

  payload.files = filesList;

  // Map primary S3 key
  const pdfFile = filesList.find((fi) => fi.file_type === "PDF");
  const jsonFile = filesList.find((fi) => fi.file_type === "JSON");
  if (pdfFile) {
    payload.pdf_s3_key = pdfFile.s3_key;
  }
  if (jsonFile) {
    payload.json_s3_key = jsonFile.s3_key;
  }

  const result = await service.reportUpload(payload, _caller(req));
  res.status(201).json(result);
});

const reportFiles = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.reportFiles(req.body || {}, _caller(req));
  res.status(201).json(result);
});

const getReportStatus = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.getReportStatus(req.params.id, _caller(req));
  res.json(result);
});

const syncQueueItem = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.registerSyncQueueItem(req.body || {}, _caller(req));
  res.status(201).json({
    status: "success",
    message: "Sync queue item registered successfully",
    data: result,
  });
});

const updateSyncStatus = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.syncReport(req.body || {}, _caller(req));
  res.json(result);
});

const getPendingSync = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const data = await service.getPendingSync(req.query || {}, _caller(req));
  res.json({
    status: "success",
    message: "Pending sync items fetched successfully",
    data,
  });
});

const heartbeat = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.heartbeat(req.body || {}, _caller(req));
  res.json(result);
});

module.exports = {
  login,
  reportUpload,
  reportFiles,
  getReportStatus,
  syncQueueItem,
  updateSyncStatus,
  getPendingSync,
  heartbeat,
};
