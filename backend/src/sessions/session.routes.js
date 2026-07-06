"use strict";

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const {
  startSession,
  uploadMetrics,
  uploadWaveform,
  endSession,
} = require("./session.controller");

// Require authentication for all desktop sessions routes
router.use(authenticate);

router.post("/start", startSession);
router.post("/:id/metrics", uploadMetrics);
router.post("/:id/waveform", uploadWaveform);
router.post("/:id/end", endSession);

module.exports = router;
