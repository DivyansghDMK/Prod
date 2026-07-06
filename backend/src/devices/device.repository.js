"use strict";

/**
 * device.repository.js
 * All database access for the devices and device_heartbeats tables.
 */

const { getPool } = require("../config/db");

// How many minutes without a heartbeat = offline
const OFFLINE_THRESHOLD_MINUTES =
  parseInt(process.env.DEVICE_OFFLINE_THRESHOLD_MINUTES || "5", 10);

class DeviceRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * Register a new device.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const { rows } = await this.db.query(
      `INSERT INTO devices (
         organization_id, license_id, rhythmulta_serial, machine_serial,
         device_name, firmware_version, software_version, hardware_version,
         activation_status, status, ip_address, mac_address, updated_at
       ) VALUES (
         $1,  $2,  $3,  $4,
         $5,  $6,  $7,  $8,
         COALESCE($9,  'PENDING'),
         COALESCE($10, 'ACTIVE'),
         $11, $12, NOW()
       )
       RETURNING *`,
      [
        data.organization_id,
        data.license_id        ?? null,
        data.rhythmulta_serial,
        data.machine_serial,
        data.device_name       ?? null,
        data.firmware_version  ?? null,
        data.software_version  ?? null,
        data.hardware_version  ?? null,
        data.activation_status ?? null,
        data.status            ?? null,
        data.ip_address        ?? null,
        data.mac_address       ?? null,
      ]
    );
    return rows[0];
  }

  // ─── Read one ─────────────────────────────────────────────────────────────

  /**
   * Fetch a device by UUID, joined with organization name.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const { rows } = await this.db.query(
      `SELECT d.*,
              o.name AS organization_name,
              (d.last_heartbeat IS NOT NULL
               AND d.last_heartbeat > NOW() - INTERVAL '${OFFLINE_THRESHOLD_MINUTES} minutes'
              ) AS is_online
       FROM   devices       d
       LEFT   JOIN organizations o ON o.id = d.organization_id
       WHERE  d.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find a device by RhythmUltra serial (unique check).
   * @param {string} serial
   * @returns {Promise<object|null>}
   */
  async findByRhythmUltraSerial(serial) {
    const { rows } = await this.db.query(
      `SELECT id FROM devices WHERE rhythmulta_serial = $1 LIMIT 1`,
      [serial]
    );
    return rows[0] || null;
  }

  /**
   * Find a device by machine serial (unique check).
   * @param {string} serial
   * @returns {Promise<object|null>}
   */
  async findByMachineSerial(serial) {
    const { rows } = await this.db.query(
      `SELECT id FROM devices WHERE machine_serial = $1 LIMIT 1`,
      [serial]
    );
    return rows[0] || null;
  }

  // ─── Read many ───────────────────────────────────────────────────────────

  /**
   * List devices with optional filters and full-text search.
   *
   * @param {{
   *   limit?: number,
   *   offset?: number,
   *   organizationId?: string|null,
   *   search?: string|null,
   *   status?: string|null,
   *   activationStatus?: string|null,
   * }} opts
   * @returns {Promise<object[]>}
   */
  async findMany({
    limit = 20,
    offset = 0,
    organizationId = null,
    search = null,
    status = null,
    activationStatus = null,
  } = {}) {
    const conditions = [];
    const values     = [];
    let   p          = 1;

    if (organizationId) {
      conditions.push(`d.organization_id = $${p++}`);
      values.push(organizationId);
    }
    if (status) {
      conditions.push(`d.status = $${p++}`);
      values.push(status);
    }
    if (activationStatus) {
      conditions.push(`d.activation_status = $${p++}`);
      values.push(activationStatus);
    }
    if (search) {
      conditions.push(
        `(d.rhythmulta_serial ILIKE $${p} OR d.machine_serial ILIKE $${p} OR d.device_name ILIKE $${p})`
      );
      values.push(`%${search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    values.push(limit, offset);
    const limitP  = p++;
    const offsetP = p;

    const { rows } = await this.db.query(
      `SELECT d.*,
              o.name AS organization_name,
              (d.last_heartbeat IS NOT NULL
               AND d.last_heartbeat > NOW() - INTERVAL '${OFFLINE_THRESHOLD_MINUTES} minutes'
              ) AS is_online
       FROM   devices       d
       LEFT   JOIN organizations o ON o.id = d.organization_id
       ${where}
       ORDER  BY d.created_at DESC
       LIMIT  $${limitP} OFFSET $${offsetP}`,
      values
    );
    return rows;
  }

  /**
   * Count devices matching filters.
   * @param {{ organizationId?, search?, status?, activationStatus? }} opts
   * @returns {Promise<number>}
   */
  async countMany({
    organizationId = null,
    search = null,
    status = null,
    activationStatus = null,
  } = {}) {
    const conditions = [];
    const values     = [];
    let   p          = 1;

    if (organizationId) { conditions.push(`organization_id = $${p++}`); values.push(organizationId); }
    if (status)         { conditions.push(`status = $${p++}`);          values.push(status); }
    if (activationStatus) { conditions.push(`activation_status = $${p++}`); values.push(activationStatus); }
    if (search) {
      conditions.push(
        `(rhythmulta_serial ILIKE $${p} OR machine_serial ILIKE $${p} OR device_name ILIKE $${p})`
      );
      values.push(`%${search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM devices ${where}`,
      values
    );
    return rows[0]?.count || 0;
  }

  // ─── Online / Offline lists ──────────────────────────────────────────────

  /**
   * Fetch only devices whose last heartbeat is within the threshold.
   * @param {{ organizationId?, limit?, offset? }} opts
   * @returns {Promise<object[]>}
   */
  async findOnline({ organizationId = null, limit = 20, offset = 0 } = {}) {
    const cond   = organizationId ? "AND d.organization_id = $3" : "";
    const values = organizationId
      ? [limit, offset, organizationId]
      : [limit, offset];

    const { rows } = await this.db.query(
      `SELECT d.*, o.name AS organization_name, TRUE AS is_online
       FROM   devices       d
       LEFT   JOIN organizations o ON o.id = d.organization_id
       WHERE  d.last_heartbeat IS NOT NULL
         AND  d.last_heartbeat > NOW() - INTERVAL '${OFFLINE_THRESHOLD_MINUTES} minutes'
         ${cond}
       ORDER  BY d.last_heartbeat DESC
       LIMIT  $1 OFFSET $2`,
      values
    );
    return rows;
  }

  /**
   * Fetch devices whose last heartbeat is beyond the threshold (or never received).
   * @param {{ organizationId?, limit?, offset? }} opts
   * @returns {Promise<object[]>}
   */
  async findOffline({ organizationId = null, limit = 20, offset = 0 } = {}) {
    const cond   = organizationId ? "AND d.organization_id = $3" : "";
    const values = organizationId
      ? [limit, offset, organizationId]
      : [limit, offset];

    const { rows } = await this.db.query(
      `SELECT d.*, o.name AS organization_name, FALSE AS is_online
       FROM   devices       d
       LEFT   JOIN organizations o ON o.id = d.organization_id
       WHERE  (d.last_heartbeat IS NULL
               OR d.last_heartbeat <= NOW() - INTERVAL '${OFFLINE_THRESHOLD_MINUTES} minutes')
         ${cond}
       ORDER  BY d.last_heartbeat DESC NULLS LAST
       LIMIT  $1 OFFSET $2`,
      values
    );
    return rows;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Update device fields.
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object|null>}
   */
  async update(id, data) {
    const { rows } = await this.db.query(
      `UPDATE devices
       SET
         license_id        = COALESCE($2,  license_id),
         device_name       = COALESCE($3,  device_name),
         firmware_version  = COALESCE($4,  firmware_version),
         software_version  = COALESCE($5,  software_version),
         hardware_version  = COALESCE($6,  hardware_version),
         activation_status = COALESCE($7,  activation_status),
         status            = COALESCE($8,  status),
         ip_address        = COALESCE($9,  ip_address),
         mac_address       = COALESCE($10, mac_address),
         updated_at        = NOW()
       WHERE  id = $1
       RETURNING *`,
      [
        id,
        data.license_id        ?? null,
        data.device_name       ?? null,
        data.firmware_version  ?? null,
        data.software_version  ?? null,
        data.hardware_version  ?? null,
        data.activation_status ?? null,
        data.status            ?? null,
        data.ip_address        ?? null,
        data.mac_address       ?? null,
      ]
    );
    return rows[0] || null;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Hard-delete a device.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const { rowCount } = await this.db.query(
      `DELETE FROM devices WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  }

  // ─── Heartbeat ───────────────────────────────────────────────────────────

  /**
   * Record a heartbeat and bump device.last_heartbeat + last_sync.
   *
   * @param {{
   *   deviceId: string,
   *   appVersion?: string,
   *   firmwareVersion?: string,
   *   status?: string,
   *   ipAddress?: string,
   * }} data
   * @returns {Promise<object>}  The inserted heartbeat row
   */
  async recordHeartbeat({ deviceId, appVersion, firmwareVersion, status, ipAddress }) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      // Insert heartbeat record
      const { rows: hbRows } = await client.query(
        `INSERT INTO device_heartbeats
           (device_id, app_version, firmware_version, status, ip_address)
         VALUES ($1, $2, $3, COALESCE($4, 'ONLINE'), $5)
         RETURNING *`,
        [deviceId, appVersion ?? null, firmwareVersion ?? null, status ?? null, ipAddress ?? null]
      );

      // Bump device timestamps and optionally update firmware/ip
      await client.query(
        `UPDATE devices
         SET
           last_heartbeat   = NOW(),
           last_sync        = NOW(),
           firmware_version = COALESCE($2, firmware_version),
           ip_address       = COALESCE($3, ip_address),
           updated_at       = NOW()
         WHERE id = $1`,
        [deviceId, firmwareVersion ?? null, ipAddress ?? null]
      );

      await client.query("COMMIT");
      return hbRows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // ─── Heartbeat history ───────────────────────────────────────────────────

  /**
   * Retrieve paginated heartbeat history for a device.
   *
   * @param {string} deviceId
   * @param {{ limit?: number, offset?: number }} opts
   * @returns {Promise<object[]>}
   */
  async findHeartbeatHistory(deviceId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `SELECT *
       FROM   device_heartbeats
       WHERE  device_id = $1
       ORDER  BY heartbeat_time DESC
       LIMIT  $2 OFFSET $3`,
      [deviceId, limit, offset]
    );
    return rows;
  }

  /**
   * Count heartbeat records for a device.
   * @param {string} deviceId
   * @returns {Promise<number>}
   */
  async countHeartbeatHistory(deviceId) {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM device_heartbeats WHERE device_id = $1`,
      [deviceId]
    );
    return rows[0]?.count || 0;
  }
}

function createDeviceRepository(pool) {
  return new DeviceRepository(pool);
}

module.exports = { DeviceRepository, createDeviceRepository };
