"use strict";

const router = require("express").Router();

const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");

const { upload } = require("../middleware/upload");
const {
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
} = require("./report.controller");

// Require authentication for all report routes
router.use(authenticate);

// --- Static routes (must come before /:id) ---

router.post(
  "/upload",
  authorize("report:upload"),
  upload.any(),
  uploadReport
);

router.get(
  "/pending-review",
  authorize("report:view"),
  getPendingReview
);

router.get(
  "/approved",
  authorize("report:view"),
  getApproved
);

router.get(
  "/patient/:patientId",
  authorize("report:view"),
  getReportsByPatientId
);

// --- Collection routes ---

router.post(
  "/",
  authorize("report:create"),
  createReport
);

router.get(
  "/",
  authorize("report:view"),
  listReports
);

// --- Per-report routes ---

router.get(
  "/:id",
  authorize("report:view"),
  getReportById
);

router.get(
  "/:id/files",
  authorize("report:download"),
  getReportFiles
);

router.get(
  "/:id/download-url",
  authorize("report:download"),
  getDownloadUrl
);

router.get(
  "/:id/upload-url",
  authorize("report:upload"),
  getUploadUrl
);

router.put(
  "/:id/status",
  authorize("report:update"),
  updateReportStatus
);

router.post(
  "/:id/review",
  authorize("report:review"),
  submitReportReview
);

// Module-scoped error handler
router.use(reportErrorHandler);

module.exports = router;
