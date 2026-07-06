"use strict";

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const {
  startSession,
  updateSession,
  finishSession,
  getSessionById,
} = require("./session.controller");

// Require authentication for all desktop session operations
router.use(authenticate);

router.post("/start", authorize("desktop:session"), startSession);
router.put("/:id", authorize("desktop:session"), updateSession);
router.post("/:id/finish", authorize("desktop:session"), finishSession);
router.get("/:id", authorize("desktop:session"), getSessionById);

module.exports = router;
