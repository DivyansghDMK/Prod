"use strict";

const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { createReportService } = require("./report.service");

function _getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createReportService(pool);
}

function _caller(req) {
  return {
    user: req.user || null,
    role: req.role || null,
    organization: req.organization || null,
    permissions: req.permissions || [],
  };
}

const createReport = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const report = await service.createReport(req.body || {}, _caller(req));
  res.status(201).json({
    message: "Report created successfully",
    data: report,
  });
});

const uploadReport = asyncHandler(async (req, res) => {
  const crypto = require("crypto");
  const fs = require("fs");
  const path = require("path");

  let payload = {};
  if (req.body.metadata) {
    try {
      payload = JSON.parse(req.body.metadata);
    } catch (err) {
      throw new HttpError("Invalid metadata JSON format", 400);
    }
  } else {
    payload = req.body;
  }

  // Multer populates req.files or req.file
  const filesList = [];
  const incomingFiles = req.files || (req.file ? [req.file] : []);

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

  const service = _getService(req);
  const result = await service.uploadReport(payload, _caller(req));
  res.status(201).json(result);
});

const listReports = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.listReports(req.query || {}, _caller(req));
  res.json({
    message: "Reports fetched successfully",
    ...result,
  });
});

const getReportById = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const report = await service.getReportById(req.params.id, _caller(req));
  res.json({
    message: "Report fetched successfully",
    data: report,
  });
});

const getReportFiles = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const data = await service.getReportFiles(req.params.id, _caller(req));
  res.json({
    message: "Report files fetched successfully",
    data,
  });
});

const getReportsByPatientId = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.getReportsByPatientId(req.params.patientId, req.query || {}, _caller(req));
  res.json({
    message: "Patient reports fetched successfully",
    ...result,
  });
});

const updateReportStatus = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const report = await service.updateReportStatus(req.params.id, req.body || {}, _caller(req));
  res.json({
    message: "Report status updated successfully",
    data: report,
  });
});

const submitReportReview = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.submitReportReview(req.params.id, req.body || {}, _caller(req));
  res.json({
    message: "Report review submitted successfully",
    ...result,
  });
});

const getPendingReview = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.getPendingReview(req.query || {}, _caller(req));
  res.json({
    message: "Reports pending review fetched successfully",
    ...result,
  });
});

const getApproved = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.getApproved(req.query || {}, _caller(req));
  res.json({
    message: "Approved reports fetched successfully",
    ...result,
  });
});

const getDownloadUrl = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const report = await service.getReportById(req.params.id, _caller(req));

  const { getSignedS3Url } = require("../utils/s3");
  const url = getSignedS3Url(null, report.pdf_s3_key || `reports/${report.id}.pdf`, "getObject");

  res.json({
    message: "Download URL generated successfully",
    url,
  });
});

const getUploadUrl = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const report = await service.getReportById(req.params.id, _caller(req));

  const fileType = req.query.fileType || "PDF";
  const extension = String(fileType).toLowerCase() === "pdf" ? "pdf" : "json";
  const s3Key = `reports/${report.id}.${extension}`;

  const { getSignedS3Url } = require("../utils/s3");
  const url = getSignedS3Url(null, s3Key, "putObject");

  res.json({
    message: "Upload URL generated successfully",
    url,
    s3Key,
  });
});

const reportErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }
  return next(err);
};

module.exports = {
  createReport,
  uploadReport,
  listReports,
  getReportById,
  getReportFiles,
  getReportsByPatientId,
  updateReportStatus,
  submitReportReview,
  getPendingReview,
  getApproved,
  getDownloadUrl,
  getUploadUrl,
  reportErrorHandler,
};
