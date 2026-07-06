"use strict";

/**
 * patient.routes.js
 * Express router for the /patients namespace.
 *
 * RBAC matrix:
 * ────────────────────────────────────────────────────────
 *  Route                        Permission
 * ────────────────────────────────────────────────────────
 *  POST   /                     patient:create
 *  GET    /                     patient:view
 *  GET    /search               patient:view
 *  GET    /:id                  patient:view
 *  PUT    /:id                  patient:update
 *  DELETE /:id                  patient:delete
 *  GET    /:id/visits           visit:view
 *  POST   /:id/visits           visit:create
 * ────────────────────────────────────────────────────────
 *
 * All routes require a valid JWT (authenticate).
 * Org-isolation is enforced in PatientService.
 *
 * IMPORTANT: /search is declared before /:id so Express does not
 * treat the literal string "search" as a patient UUID.
 */

const router = require("express").Router();

const { authenticate } = require("../middleware/auth");
const { authorize }    = require("../middleware/roles");

const {
  createPatient,
  listPatients,
  searchPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  listVisits,
  createVisit,
  patientErrorHandler,
} = require("./patient.controller");

// ── All patient routes require authentication ──────────────────────────────
router.use(authenticate);

// ── Static routes (must come before /:id) ─────────────────────────────────

/**
 * GET /patients/search
 * Query: search (name), phone, mrn — at least one required
 * Supports the same pagination and filter params as GET /patients
 */
router.get(
  "/search",
  authorize("patient:view"),
  searchPatients
);

// ── Collection routes ──────────────────────────────────────────────────────

router.post(
  "/",
  authorize("patient:create"),
  createPatient
);

router.get(
  "/",
  authorize("patient:view"),
  listPatients
);

// ── Per-patient routes ─────────────────────────────────────────────────────

// Visit sub-routes under /:id
router.get(
  "/:id/visits",
  authorize("visit:view"),
  listVisits
);

router.post(
  "/:id/visits",
  authorize("visit:create"),
  createVisit
);

// Core CRUD on /:id
router.get(
  "/:id",
  authorize("patient:view"),
  getPatientById
);

router.put(
  "/:id",
  authorize("patient:update"),
  updatePatient
);

router.delete(
  "/:id",
  authorize("patient:delete"),
  deletePatient
);

// ── Module-scoped error handler ────────────────────────────────────────────
router.use(patientErrorHandler);

module.exports = router;
