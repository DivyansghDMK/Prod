"use strict";

/**
 * patient.controller.js
 * Thin HTTP layer — parses requests, delegates to PatientService, shapes responses.
 * All business rules, validation, and org-scoping live in the service layer.
 */

const { asyncHandler }         = require("../utils/asyncHandler");
const { HttpError }            = require("../utils/httpError");
const { createPatientService } = require("./patient.service");

// ─── DI helper ───────────────────────────────────────────────────────────────

function _getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createPatientService(pool);
}

/**
 * Build a caller context from the authenticated request.
 * authenticate() middleware populates req.user, req.organization, req.role.
 */
function _caller(req) {
  return {
    user:         req.user         || null,
    role:         req.role         || null,
    organization: req.organization || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /patients
// Body: patient fields
// ─────────────────────────────────────────────────────────────────────────────
const createPatient = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const patient = await service.createPatient(req.body || {}, _caller(req));
  res.status(201).json({
    message: "Patient created successfully",
    data:    patient,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /patients
// Query: page, limit, search, phone, mrn, gender, date_from, date_to,
//        organization_id (SUPER_ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
const listPatients = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result  = await service.listPatients(req.query || {}, _caller(req));
  res.json({
    message: "Patients fetched successfully",
    ...result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /patients/search
// Query: search (name), phone, mrn  — at least one required
// ─────────────────────────────────────────────────────────────────────────────
const searchPatients = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result  = await service.searchPatients(req.query || {}, _caller(req));
  res.json({
    message: "Search results fetched successfully",
    ...result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /patients/:id
// ─────────────────────────────────────────────────────────────────────────────
const getPatientById = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const patient = await service.getPatientById(req.params.id, _caller(req));
  res.json({
    message: "Patient fetched successfully",
    data:    patient,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /patients/:id
// Body: partial patient fields
// ─────────────────────────────────────────────────────────────────────────────
const updatePatient = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const patient = await service.updatePatient(req.params.id, req.body || {}, _caller(req));
  res.json({
    message: "Patient updated successfully",
    data:    patient,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /patients/:id    (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
const deletePatient = asyncHandler(async (req, res) => {
  const service = _getService(req);
  await service.deletePatient(req.params.id, _caller(req));
  res.json({ message: "Patient deleted successfully" });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /patients/:id/visits
// Query: page, limit
// ─────────────────────────────────────────────────────────────────────────────
const listVisits = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result  = await service.listVisits(req.params.id, req.query || {}, _caller(req));
  res.json({
    message: "Patient visits fetched successfully",
    ...result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /patients/:id/visits
// Body: { organization_id?, doctor_id?, device_id?, visit_type, visit_date?,
//         symptoms?, diagnosis?, notes? }
// ─────────────────────────────────────────────────────────────────────────────
const createVisit = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const visit   = await service.createVisit(req.params.id, req.body || {}, _caller(req));
  res.status(201).json({
    message: "Visit created successfully",
    data:    visit,
  });
});

// ─── Module-scoped error handler ─────────────────────────────────────────────
const patientErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }
  return next(err);
};

module.exports = {
  createPatient,
  listPatients,
  searchPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  listVisits,
  createVisit,
  patientErrorHandler,
};
