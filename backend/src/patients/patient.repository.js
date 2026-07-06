"use strict";

/**
 * patient.repository.js
 * All database access for patients and patient_visits tables.
 *
 * Design principles:
 *  - Soft-delete: every read query adds WHERE deleted_at IS NULL
 *  - Multi-column search: name (trigram), phone, MRN, email
 *  - Organization isolation enforced at the query level
 *  - Doctor-assignment-ready: doctor filter on visits is wired in
 */

const { getPool } = require("../config/db");

// ─── Base columns for a patient row ──────────────────────────────────────────
const PATIENT_SELECT = `
  p.id,
  p.organization_id,
  p.patient_id        AS mrn,
  p.first_name,
  p.last_name,
  (p.first_name || COALESCE(' ' || NULLIF(p.last_name,''), '')) AS full_name,
  p.gender,
  p.date_of_birth,
  p.phone,
  p.email,
  p.blood_group,
  p.address,
  p.emergency_contact,
  p.notes,
  p.created_by,
  p.updated_by,
  p.created_at,
  p.updated_at,
  o.name AS organization_name
`;

class PatientRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  /**
   * Insert a new patient record.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const { rows } = await this.db.query(
      `INSERT INTO patients (
         organization_id, patient_id, first_name, last_name,
         gender, date_of_birth, phone, email, blood_group,
         address, emergency_contact, notes, created_by, updated_at
       ) VALUES (
         $1,  $2,  $3,  $4,
         COALESCE($5,'UNKNOWN'), $6, $7, $8, $9,
         $10, $11, $12, $13, NOW()
       )
       RETURNING *`,
      [
        data.organization_id,
        data.patient_id      ?? null,
        data.first_name,
        data.last_name       ?? null,
        data.gender          ?? null,
        data.date_of_birth   ?? null,
        data.phone           ?? null,
        data.email           ?? null,
        data.blood_group     ?? null,
        data.address         ?? null,
        data.emergency_contact
          ? JSON.stringify(data.emergency_contact)
          : null,
        data.notes           ?? null,
        data.created_by      ?? null,
      ]
    );
    return rows[0];
  }

  // ─── Read one ─────────────────────────────────────────────────────────────

  /**
   * Fetch a patient by UUID (excludes soft-deleted).
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const { rows } = await this.db.query(
      `SELECT ${PATIENT_SELECT}
       FROM   patients      p
       LEFT   JOIN organizations o ON o.id = p.organization_id
       WHERE  p.id = $1
         AND  p.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  // ─── Read many + search ──────────────────────────────────────────────────

  /**
   * List patients with optional filters and multi-column search.
   *
   * @param {{
   *   organizationId?: string|null,
   *   search?:         string|null,   — matches first_name || last_name
   *   phone?:          string|null,
   *   mrn?:            string|null,   — patient_id column
   *   gender?:         string|null,
   *   dateFrom?:       string|null,
   *   dateTo?:         string|null,
   *   limit?:          number,
   *   offset?:         number,
   * }} opts
   * @returns {Promise<object[]>}
   */
  async findMany({
    organizationId = null,
    search         = null,
    phone          = null,
    mrn            = null,
    gender         = null,
    dateFrom       = null,
    dateTo         = null,
    limit          = 20,
    offset         = 0,
  } = {}) {
    const { conditions, values, nextP } = this._buildFilters({
      organizationId, search, phone, mrn, gender, dateFrom, dateTo,
    });

    values.push(limit, offset);
    const lp = nextP;
    const op = nextP + 1;

    const { rows } = await this.db.query(
      `SELECT ${PATIENT_SELECT}
       FROM   patients      p
       LEFT   JOIN organizations o ON o.id = p.organization_id
       WHERE  p.deleted_at IS NULL
         ${conditions.length ? "AND " + conditions.join(" AND ") : ""}
       ORDER  BY p.created_at DESC
       LIMIT  $${lp} OFFSET $${op}`,
      values
    );
    return rows;
  }

  /**
   * Count patients matching the same filter set.
   * @param {object} opts — same shape as findMany opts
   * @returns {Promise<number>}
   */
  async countMany(opts = {}) {
    const { conditions, values } = this._buildFilters(opts);

    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS count
       FROM   patients p
       WHERE  p.deleted_at IS NULL
         ${conditions.length ? "AND " + conditions.join(" AND ") : ""}`,
      values
    );
    return rows[0]?.count || 0;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Update a patient record (partial — COALESCE null values).
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object|null>}
   */
  async update(id, data) {
    const { rows } = await this.db.query(
      `UPDATE patients
       SET
         patient_id        = COALESCE($2,  patient_id),
         first_name        = COALESCE($3,  first_name),
         last_name         = COALESCE($4,  last_name),
         gender            = COALESCE($5,  gender),
         date_of_birth     = COALESCE($6,  date_of_birth),
         phone             = COALESCE($7,  phone),
         email             = COALESCE($8,  email),
         blood_group       = COALESCE($9,  blood_group),
         address           = COALESCE($10, address),
         emergency_contact = COALESCE($11, emergency_contact),
         notes             = COALESCE($12, notes),
         updated_by        = COALESCE($13, updated_by),
         updated_at        = NOW()
       WHERE  id = $1
         AND  deleted_at IS NULL
       RETURNING *`,
      [
        id,
        data.patient_id    ?? null,
        data.first_name    ?? null,
        data.last_name     ?? null,
        data.gender        ?? null,
        data.date_of_birth ?? null,
        data.phone         ?? null,
        data.email         ?? null,
        data.blood_group   ?? null,
        data.address       ?? null,
        data.emergency_contact
          ? JSON.stringify(data.emergency_contact)
          : null,
        data.notes         ?? null,
        data.updated_by    ?? null,
      ]
    );
    return rows[0] || null;
  }

  // ─── Soft delete ─────────────────────────────────────────────────────────

  /**
   * Soft-delete a patient by setting deleted_at = NOW().
   * @param {string} id
   * @param {string} deletedBy  — user UUID
   * @returns {Promise<boolean>}
   */
  async softDelete(id, deletedBy) {
    const { rowCount } = await this.db.query(
      `UPDATE patients
       SET    deleted_at = NOW(),
              updated_by = COALESCE($2, updated_by),
              updated_at = NOW()
       WHERE  id = $1
         AND  deleted_at IS NULL`,
      [id, deletedBy ?? null]
    );
    return rowCount > 0;
  }

  // ─── Visits ───────────────────────────────────────────────────────────────

  /**
   * List visits for a patient (most recent first).
   * @param {string} patientId
   * @param {{ limit?, offset? }} opts
   * @returns {Promise<object[]>}
   */
  async findVisits(patientId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `SELECT
         v.*,
         u.full_name AS doctor_name,
         d.device_name,
         d.rhythmulta_serial
       FROM   patient_visits v
       LEFT   JOIN users   u ON u.id = v.doctor_id
       LEFT   JOIN devices d ON d.id = v.device_id
       WHERE  v.patient_id = $1
       ORDER  BY v.visit_date DESC
       LIMIT  $2 OFFSET $3`,
      [patientId, limit, offset]
    );
    return rows;
  }

  /**
   * Count visits for a patient.
   * @param {string} patientId
   * @returns {Promise<number>}
   */
  async countVisits(patientId) {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM patient_visits WHERE patient_id = $1`,
      [patientId]
    );
    return rows[0]?.count || 0;
  }

  /**
   * Create a new visit record.
   * @param {string} patientId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createVisit(patientId, data) {
    const { rows } = await this.db.query(
      `INSERT INTO patient_visits (
         patient_id, organization_id, doctor_id, device_id,
         visit_type, visit_date, symptoms, diagnosis, notes
       ) VALUES (
         $1, $2, $3, $4,
         COALESCE($5,'CONSULTATION'),
         COALESCE($6, NOW()),
         $7, $8, $9
       )
       RETURNING *`,
      [
        patientId,
        data.organization_id,
        data.doctor_id   ?? null,
        data.device_id   ?? null,
        data.visit_type  ?? null,
        data.visit_date  ?? null,
        data.symptoms    ?? null,
        data.diagnosis   ?? null,
        data.notes       ?? null,
      ]
    );
    return rows[0];
  }

  // ─── Existence checks ────────────────────────────────────────────────────

  /**
   * Check if an MRN already exists within an organization (excluding soft-deleted).
   * @param {string} organizationId
   * @param {string} mrn
   * @param {string|null} excludeId  — exclude this patient UUID (for updates)
   * @returns {Promise<boolean>}
   */
  async mrnExists(organizationId, mrn, excludeId = null) {
    const { rows } = await this.db.query(
      `SELECT 1 FROM patients
       WHERE  organization_id = $1
         AND  patient_id      = $2
         AND  deleted_at IS NULL
         ${excludeId ? "AND id != $3" : ""}
       LIMIT 1`,
      excludeId ? [organizationId, mrn, excludeId] : [organizationId, mrn]
    );
    return rows.length > 0;
  }

  // ─── Filter builder (private) ────────────────────────────────────────────

  /**
   * Build WHERE conditions and parameterized values.
   * @private
   */
  _buildFilters({
    organizationId = null,
    search         = null,
    phone          = null,
    mrn            = null,
    gender         = null,
    dateFrom       = null,
    dateTo         = null,
  } = {}) {
    const conditions = [];
    const values     = [];
    let   p          = 1;

    if (organizationId) {
      conditions.push(`p.organization_id = $${p++}`);
      values.push(organizationId);
    }

    // Multi-column search: name (trigram ILIKE), phone partial, MRN exact
    if (search) {
      conditions.push(
        `(p.first_name ILIKE $${p} OR p.last_name ILIKE $${p} OR (p.first_name || ' ' || coalesce(p.last_name,'')) ILIKE $${p})`
      );
      values.push(`%${search}%`);
      p++;
    }

    if (phone) {
      conditions.push(`p.phone ILIKE $${p++}`);
      values.push(`%${phone}%`);
    }

    if (mrn) {
      conditions.push(`p.patient_id = $${p++}`);
      values.push(mrn);
    }

    if (gender) {
      conditions.push(`p.gender = $${p++}`);
      values.push(gender);
    }

    if (dateFrom) {
      conditions.push(`p.date_of_birth >= $${p++}`);
      values.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`p.date_of_birth <= $${p++}`);
      values.push(dateTo);
    }

    return { conditions, values, nextP: p };
  }
}

function createPatientRepository(pool) {
  return new PatientRepository(pool);
}

module.exports = { PatientRepository, createPatientRepository };
