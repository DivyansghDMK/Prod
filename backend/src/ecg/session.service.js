"use strict";

const { HttpError } = require("../utils/httpError");
const { createSessionRepository } = require("./session.repository");
const { createPatientRepository } = require("../patients/patient.repository");
const { createDeviceRepository } = require("../devices/device.repository");
const { validateSessionPayload } = require("./session.validation");

class SessionService {
  constructor(
    repository = createSessionRepository(),
    patientRepository = createPatientRepository(),
    deviceRepository = createDeviceRepository()
  ) {
    this.repository = repository;
    this.patientRepository = patientRepository;
    this.deviceRepository = deviceRepository;
  }

  async startSession(payload, caller) {
    // Dynamic Resolution: Organization
    let organizationId = payload.organization_id || caller.organization?.id;
    if (!organizationId) {
      throw new HttpError("organization_id is required", 400);
    }
    payload.organization_id = organizationId;

    // Dynamic Resolution: Device
    if (payload.device_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.device_id)) {
      const device = await this.deviceRepository.findByMachineSerial(payload.device_id) || 
                     await this.deviceRepository.findByRhythmUltraSerial(payload.device_id);
      if (device) {
        payload.device_id = device.id;
      } else {
        throw new HttpError(`Device with serial ${payload.device_id} is not registered`, 400);
      }
    }

    const client = await this.repository.db.connect();
    try {
      await client.query("BEGIN");

      // Dynamic Resolution: Patient (Find or Create dynamic fallback)
      let patientId = payload.patient_id;
      if (!patientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
        const patientName = payload.patient_name || "Offline Sync Patient";
        const names = String(patientName).split(" ");
        const firstName = names[0] || "Offline";
        const lastName = names.slice(1).join(" ") || "Sync";

        const findQuery = `
          SELECT id FROM patients
          WHERE organization_id = $1 AND deleted_at IS NULL
            AND (patient_id = $2 OR (first_name = $3 AND last_name = $4))
          LIMIT 1;
        `;
        const { rows } = await client.query(findQuery, [
          organizationId,
          payload.patient_id || "OFFLINE-SYNC",
          firstName,
          lastName
        ]);

        if (rows[0]) {
          patientId = rows[0].id;
        } else {
          const createQuery = `
            INSERT INTO patients (organization_id, patient_id, first_name, last_name, gender)
            VALUES ($1, $2, $3, $4, 'UNKNOWN')
            RETURNING id;
          `;
          const { rows: newRows } = await client.query(createQuery, [
            organizationId,
            payload.patient_id || "OFFLINE-SYNC",
            firstName,
            lastName
          ]);
          patientId = newRows[0].id;
        }
      }
      payload.patient_id = patientId;

      // Validate
      const validation = validateSessionPayload(payload);
      if (!validation.ok) {
        throw new HttpError("Validation failed", 400, validation.errors);
      }

      // Multi-tenant check
      if (caller.role !== "SUPER_ADMIN" && validation.data.organization_id !== caller.organization?.id) {
        throw new HttpError("Forbidden: Cannot start session for another organization", 403);
      }

      const session = await this.repository.create(validation.data, client);
      await client.query("COMMIT");
      return session;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionById(id, caller) {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new HttpError("ECG Session not found", 404);
    }

    if (caller.role !== "SUPER_ADMIN" && session.organization_id !== caller.organization?.id) {
      throw new HttpError("ECG Session not found", 404); // opaque
    }

    return session;
  }

  async updateSession(id, payload, caller) {
    // Check access
    await this.getSessionById(id, caller);

    // Validate
    const validation = validateSessionPayload(payload, { partial: true });
    if (!validation.ok) {
      throw new HttpError("Validation failed", 400, validation.errors);
    }

    return this.repository.update(id, validation.data);
  }

  async finishSession(id, payload, caller) {
    const session = await this.getSessionById(id, caller);

    const status = payload.session_status || "COMPLETED";
    const VALID_FINISH_STATUSES = ["COMPLETED", "FAILED"];
    if (!VALID_FINISH_STATUSES.includes(status)) {
      throw new HttpError("Invalid finish status. Must be COMPLETED or FAILED", 400);
    }

    return this.repository.finish(id, status, payload.report_id || null);
  }
}

function createSessionService(pool, patientRepository, deviceRepository) {
  return new SessionService(
    createSessionRepository(pool),
    patientRepository || createPatientRepository(pool),
    deviceRepository || createDeviceRepository(pool)
  );
}

module.exports = { SessionService, createSessionService };
