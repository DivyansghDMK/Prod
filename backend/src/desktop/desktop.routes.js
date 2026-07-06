"use strict";

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { upload } = require("../middleware/upload");

const {
  login,
  reportUpload,
  reportFiles,
  getReportStatus,
  syncQueueItem,
  updateSyncStatus,
  getPendingSync,
  heartbeat,
} = require("./desktop.controller");

const sessionController = require("../ecg/session.controller");

// ── Public Routes ───────────────────────────────────────────────────────────
router.post("/login", login);

// ── Protected Routes (require authentication) ───────────────────────────────
router.use(authenticate);

// ECG Session routes forwarded from desktop namespace
router.post("/session/start", authorize("desktop:session"), sessionController.startSession);
router.put("/session/:id", authorize("desktop:session"), sessionController.updateSession);
router.post("/session/:id/finish", authorize("desktop:session"), sessionController.finishSession);
router.get("/session/:id", authorize("desktop:session"), sessionController.getSessionById);

// Reports Upload & Mapping
router.post("/report/upload", authorize("report:upload"), upload.any(), reportUpload);
router.post("/report/files", authorize("report:upload"), reportFiles);
router.get("/report/status/:id", authorize("report:view"), getReportStatus);

// Sync Queue & Background Tasks
router.post("/sync", authorize("desktop:sync"), updateSyncStatus);
router.post("/sync/queue", authorize("desktop:sync"), syncQueueItem);
router.get("/sync/pending", authorize("desktop:sync"), getPendingSync);

// Device Heartbeat
router.post("/heartbeat", authorize("desktop:heartbeat"), heartbeat);

module.exports = router;
