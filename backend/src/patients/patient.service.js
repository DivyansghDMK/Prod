"use strict";

/**
 * patient.service.js
 * Business-logic layer for Patient Management.
 *
 * RBAC / multi-tenancy rules enforced here:
 *   SUPER_ADMIN    → cross-org access; may target any organization
 *   HCP_ADMIN      → own org only; full CRUD + visits
 *   HCP_CLINICAL   → own org only; create / view / update patients + visits
 *   DOCTOR_*       → own org only; view patients (doctor-assignment scoping
 *                    is future-ready — currently any org-member doctor can view)
 *   RECEPTIONIST   → own org only; create + view patients (no visits)
 */

const { HttpError }              = require("../utils/httpError");
const { createPatientRepository } = require("./patient.repository");
const {
  validatePatientPayload,
  validateVisitPayload,
  parsePatientQuery,
} = require("./patient.validation");

// Roles whose access is always scoped to their own organization
const ORG_SCOPED_ROLES = new Set([
  "HCP_ADMIN", "HCP_CLINICAL", "DOCTOR_ADMIN", "DOCTOR_CLINICAL", "RECEPTIONIST",
]);

/**
 * Derive the effective organization_id filter.
 * SUPER_ADMIN may optionally filter by org; everyone else is clamped.
 */
function _resolveOrgId(callerRole, callerOrg, queryOrgId) {
  if (callerRole === "SUPER_ADMIN") return queryOrgId || null;
  return callerOrg?.id || null;
}

/**
 * Assert org-scoped roles can only see / modify patients in their org.
 * Uses an opaque 404 to prevent org enumeration.
 */
function _assertOwnership(patient, callerRole, callerOrg) {
  if (!ORG_SCOPED_ROLES.has(callerRole)) return; // SUPER_ADMIN passes
  if (patient.organization_id !== callerOrg?.id) {
    throw new HttpError("Patient not found", 404);
  }
}

class PatientService {
  /**
   * @param {import('./patient.repository').PatientRepository} repository
   */
  constructor(repository = createPatientRepository()) {
    this.repository = repository;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * Register a new patient.
   *
   * @param {object} payload
   * @param {{ role, organization, user }} caller
   * @returns {Promise<object>}
   */
  async createPatient(payload, caller) {
    const validation = validatePatientPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // Non-SUPER_ADMIN: clamp to own org
    if (caller.role !== "SUPER_ADMIN") {
      if (!caller.organization?.id) throw new HttpError("Organization context missing", 403);
      data.organization_id = caller.organization.id;
    }

    // MRN uniqueness check (within org)
    if (data.patient_id) {
      const exists = await this.repository.mrnExists(data.organization_id, data.patient_id);
      if (exists) {
        throw new HttpError(
          `MRN '${data.patient_id}' is already registered in this organization`,
          409
        );
      }
    }

    data.created_by = caller.user?.id || null;

    return this.repository.create(data);
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  /**
   * List patients with pagination, search, and date filters.
   *
   * @param {object} rawQuery   – req.query
   * @param {{ role, organization }} caller
   * @returns {Promise<{ data, pagination }>}
   */
  async listPatients(rawQuery, caller) {
    const q = parsePatientQuery(rawQuery);

    const orgId = _resolveOrgId(caller.role, caller.organization, q.organizationId);

    const filters = {
      organizationId: orgId,
      search:   q.search,
      phone:    q.phone,
      mrn:      q.mrn,
      gender:   q.gender,
      dateFrom: q.dateFrom,
      dateTo:   q.dateTo,
    };

    const [data, total] = await Promise.all([
      this.repository.findMany({ ...filters, limit: q.limit, offset: q.offset }),
      this.repository.countMany(filters),
    ]);

    return {
      data,
      pagination: {
        page:       q.page,
        limit:      q.limit,
        total,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  // ─── Search (convenience alias that passes through to listPatients) ─────────

  /**
   * Dedicated search — same implementation as list but validated to require
   * at least one search parameter.
   *
   * @param {object} rawQuery
   * @param {{ role, organization }} caller
   */
  async searchPatients(rawQuery, caller) {
    const q = parsePatientQuery(rawQuery);

    if (!q.search && !q.phone && !q.mrn) {
      throw new HttpError(
        "At least one search parameter is required: search, phone, or mrn",
        400
      );
    }

    return this.listPatients(rawQuery, caller);
  }

  // ─── Get by ID ─────────────────────────────────────────────────────────────

  /**
   * Fetch a single patient with ownership check.
   *
   * @param {string} id
   * @param {{ role, organization }} caller
   * @returns {Promise<object>}
   */
  async getPatientById(id, caller) {
    const patient = await this.repository.findById(id);
    if (!patient) throw new HttpError("Patient not found", 404);

    _assertOwnership(patient, caller.role, caller.organization);
    return patient;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  /**
   * Update a patient record (partial).
   *
   * @param {string} id
   * @param {object} payload
   * @param {{ role, organization, user }} caller
   * @returns {Promise<object>}
   */
  async updatePatient(id, payload, caller) {
    // Verify existence + ownership
    await this.getPatientById(id, caller);

    const validation = validatePatientPayload(payload, { partial: true });
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // MRN uniqueness check on update (exclude self)
    if (data.patient_id) {
      const orgId = caller.role === "SUPER_ADMIN"
        ? (await this.repository.findById(id)).organization_id
        : caller.organization.id;

      const exists = await this.repository.mrnExists(orgId, data.patient_id, id);
      if (exists) {
        throw new HttpError(
          `MRN '${data.patient_id}' is already used by another patient in this organization`,
          409
        );
      }
    }

    data.updated_by = caller.user?.id || null;

    const updated = await this.repository.update(id, data);
    if (!updated) throw new HttpError("Patient not found", 404);
    return updated;
  }

  // ─── Soft delete ───────────────────────────────────────────────────────────

  /**
   * Soft-delete a patient.
   *
   * @param {string} id
   * @param {{ role, organization, user }} caller
   */
  async deletePatient(id, caller) {
    await this.getPatientById(id, caller); // ownership + existence check

    const deleted = await this.repository.softDelete(id, caller.user?.id || null);
    if (!deleted) throw new HttpError("Patient not found", 404);
    return true;
  }

  // ─── Visits ────────────────────────────────────────────────────────────────

  /**
   * List visits for a patient.
   *
   * @param {string} patientId
   * @param {object} rawQuery
   * @param {{ role, organization }} caller
   * @returns {Promise<{ data, pagination }>}
   */
  async listVisits(patientId, rawQuery, caller) {
    await this.getPatientById(patientId, caller); // visibility check

    const page   = Math.max(parseInt(rawQuery.page,  10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(rawQuery.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.repository.findVisits(patientId, { limit, offset }),
      this.repository.countVisits(patientId),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Create a visit record for a patient.
   *
   * @param {string} patientId
   * @param {object} payload
   * @param {{ role, organization, user }} caller
   * @returns {Promise<object>}
   */
  async createVisit(patientId, payload, caller) {
    // Verify patient exists and caller can access it
    await this.getPatientById(patientId, caller);

    const validation = validateVisitPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // Clamp org for non-SUPER_ADMIN
    if (caller.role !== "SUPER_ADMIN") {
      data.organization_id = caller.organization.id;
    }

    // Inject requesting user as doctor if not specified and caller is a doctor
    if (!data.doctor_id && caller.role?.startsWith("DOCTOR")) {
      data.doctor_id = caller.user?.id || null;
    }

    return this.repository.createVisit(patientId, data);
  }
}

function createPatientService(pool) {
  return new PatientService(createPatientRepository(pool));
}

module.exports = { PatientService, createPatientService };
